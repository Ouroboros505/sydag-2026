"""Genomic prediction with honest validation.

Ridge on markers is GBLUP-equivalent: the field-standard baseline. Validation is
year-forward on lines never seen in training - the scheme that matches the actual
decision. Random k-fold leaks relatives across folds and reads ~0.5; it is reported
only to show the difference.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold


@dataclass
class Fit:
    model: Ridge
    cols: pd.Index
    mu: np.ndarray
    sd: np.ndarray

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        Z = (X[self.cols].to_numpy() - self.mu) / self.sd
        return self.model.predict(Z)


def fit(X: pd.DataFrame, y: pd.Series, alpha: float) -> Fit:
    mu, sd = X.mean().to_numpy(), X.std().replace(0, 1).to_numpy()
    Z = (X.to_numpy() - mu) / sd
    return Fit(Ridge(alpha=alpha).fit(Z, y.to_numpy()), X.columns, mu, sd)


def pick_alpha(X: pd.DataFrame, y: pd.Series, grid=(300, 1000, 3000, 10000, 30000)) -> float:
    """Alpha by 5-fold CV on the training set. Leaky (relatives), but fine for tuning."""
    best, best_r = grid[0], -1.0
    kf = KFold(5, shuffle=True, random_state=0)
    for a in grid:
        rs = []
        for tr, te in kf.split(X):
            f = fit(X.iloc[tr], y.iloc[tr], a)
            rs.append(np.corrcoef(f.predict(X.iloc[te]), y.iloc[te])[0, 1])
        r = float(np.nanmean(rs))
        if r > best_r:
            best, best_r = a, r
    return best


def top_share_recovered(pred: np.ndarray, true: np.ndarray, share: float = 0.2) -> float:
    k = max(1, int(round(share * len(true))))
    top_true = set(np.argsort(-true)[:k])
    top_pred = set(np.argsort(-pred)[:k])
    return len(top_true & top_pred) / k


@dataclass
class Validation:
    scheme: str
    r: float
    rmse: float
    top20: float
    n_test: int
    leaky_r: float


def year_forward(h: pd.DataFrame, M: pd.DataFrame, trait: str, test_year: int, alpha: float) -> Validation:
    """Train on lines first seen before test_year, using only their pre-test_year record;
    test on lines first seen in test_year (never in training)."""
    train = h[h.first_year < test_year]
    test = h[h.first_year == test_year]
    train = train[train.index.isin(M.index)]
    test = test[test.index.isin(M.index)]
    if train.empty or len(test) < 5:
        raise ValueError(f"year-forward needs lines first seen before {test_year} and in it; "
                         f"got {len(train)} train / {len(test)} test")
    f = fit(M.loc[train.index], train[trait], alpha)
    pred = f.predict(M.loc[test.index])
    true = test[trait].to_numpy()
    r = float(np.corrcoef(pred, true)[0, 1])
    rmse = float(np.sqrt(np.mean((pred - true) ** 2)))
    # the leaky number, for contrast
    both = pd.concat([train, test])
    kf = KFold(5, shuffle=True, random_state=1)
    ls = []
    for tr, te in kf.split(both):
        g = fit(M.loc[both.index[tr]], both[trait].iloc[tr], alpha)
        ls.append(np.corrcoef(g.predict(M.loc[both.index[te]]), both[trait].iloc[te])[0, 1])
    return Validation(
        scheme=f"year-forward: train on lines first seen before {test_year}, predict {test_year} lines never seen in training",
        r=r, rmse=rmse, top20=top_share_recovered(pred, true), n_test=len(test), leaky_r=float(np.nanmean(ls)),
    )


def relatedness_tier(M_train: pd.DataFrame, M_new: pd.DataFrame) -> pd.Series:
    """How close each new line is to anything in training, as a confidence tier.
    Correlation of standardized marker vectors ~ genomic relationship."""
    A = (M_train - M_train.mean()) / M_train.std().replace(0, 1)
    B = (M_new - M_train.mean()) / M_train.std().replace(0, 1)
    A = A.to_numpy(); B = B.to_numpy()
    A /= np.linalg.norm(A, axis=1, keepdims=True) + 1e-9
    B /= np.linalg.norm(B, axis=1, keepdims=True) + 1e-9
    best = (B @ A.T).max(axis=1)
    q1, q2 = np.quantile(best, [1 / 3, 2 / 3])
    return pd.Series(np.where(best >= q2, "high", np.where(best >= q1, "medium", "low")), index=M_new.index)


def genomic_pcs(M: pd.DataFrame, rows: pd.Index, k: int = 2) -> pd.DataFrame:
    """Top-k principal components of standardized markers, for the given rows.
    Used for the genomic map and nothing else - it is a picture, not a model input."""
    Z = ((M - M.mean()) / M.std().replace(0, 1)).to_numpy(dtype=np.float32)
    U, S, _ = np.linalg.svd(Z - Z.mean(axis=0), full_matrices=False)
    pcs = pd.DataFrame(U[:, :k] * S[:k], index=M.index, columns=[f"pc{i + 1}" for i in range(k)])
    return pcs.loc[rows]


def two_stage(f: Fit, M_lines: pd.DataFrame, family: pd.Series, M_parents: pd.DataFrame,
              parents: dict[str, tuple[str, str]]) -> np.ndarray:
    """Predict lines from families never seen before.

    Stage 1, between families: the marker model applied to each parent's own genotype;
    the family baseline is the mean of its two parents (genomic mate prediction).
    Stage 2, within family: each line's deviation from its family's mean prediction.
    Plain ridge ranks well inside a family but generalizes poorly across new families;
    this keeps the part it is good at and takes the between-family signal from parents."""
    raw = pd.Series(f.predict(M_lines), index=M_lines.index)
    fam_mean = raw.groupby(family).transform("mean")
    par_bv = pd.Series(f.predict(M_parents), index=M_parents.index)
    base = family.map(lambda p: np.nanmean([par_bv.get(x, np.nan) for x in parents.get(p, ("", ""))]))
    base = base.fillna(fam_mean)
    return (base + raw - fam_mean).to_numpy()
