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
        Z = (X[self.cols].to_numpy(dtype=np.float32) - self.mu) / self.sd
        return self.model.predict(Z)


def fit(X: pd.DataFrame, y: pd.Series, alpha: float) -> Fit:
    # float32 throughout: the full Bayer matrix is 155k x 2,911 and float64 copies do not fit
    mu = X.mean().to_numpy(dtype=np.float32)
    sd = X.std().replace(0, 1).to_numpy(dtype=np.float32)
    Z = (X.to_numpy(dtype=np.float32) - mu) / sd
    return Fit(Ridge(alpha=alpha).fit(Z, y.to_numpy(dtype=np.float32)), X.columns, mu, sd)


def pick_alpha(X: pd.DataFrame, y: pd.Series, grid=(300, 1000, 3000, 10000, 30000),
               max_rows: int = 40000) -> float:
    """Alpha by 5-fold CV on the training set. Leaky (relatives), but fine for tuning.
    A random subsample keeps this to minutes on the full dataset."""
    if len(X) > max_rows:
        pick = np.random.default_rng(0).choice(len(X), max_rows, replace=False)
        X, y = X.iloc[pick], y.iloc[pick]
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
    h = h[h[trait].notna()]   # a trait not scored on a line is missing, not zero
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
    mu = M_train.mean().to_numpy(dtype=np.float32)
    sd = M_train.std().replace(0, 1).to_numpy(dtype=np.float32)
    A = (M_train.to_numpy(dtype=np.float32) - mu) / sd
    B = (M_new.to_numpy(dtype=np.float32) - mu) / sd
    A /= np.linalg.norm(A, axis=1, keepdims=True) + 1e-9
    B /= np.linalg.norm(B, axis=1, keepdims=True) + 1e-9
    # in chunks: the full B @ A.T is new x train and does not fit at 30k x 120k
    best = np.concatenate([(B[i:i + 1000] @ A.T).max(axis=1) for i in range(0, len(B), 1000)])
    q1, q2 = np.quantile(best, [1 / 3, 2 / 3])
    return pd.Series(np.where(best >= q2, "high", np.where(best >= q1, "medium", "low")), index=M_new.index)


def genomic_pcs(M: pd.DataFrame, rows: pd.Index, k: int = 2) -> pd.DataFrame:
    """Top-k principal components of standardized markers, for the given rows.
    Used for the genomic map and nothing else - it is a picture, not a model input."""
    mu = M.mean().to_numpy(dtype=np.float32)
    sd = M.std().replace(0, 1).to_numpy(dtype=np.float32)
    Z = (M.to_numpy(dtype=np.float32) - mu) / sd
    # eigenvectors of the marker covariance: a 2,911-square problem however many lines there are
    _, V = np.linalg.eigh((Z.T @ Z).astype(np.float64))
    V = V[:, ::-1][:, :k].astype(np.float32)
    pcs = pd.DataFrame(Z @ V, index=M.index, columns=[f"pc{i + 1}" for i in range(k)])
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


# ================================================================== family-structured data
#
# The Bayer program tests each biparental family once, in one year. A new cohort is made of
# families nobody has seen, so one ridge over all lines (above) learns mostly "which families
# were good" and has little left for the new ones. The model below splits the problem the
# way a breeder does:
#
#   between families: the family's mean GCA from what its parents passed on: the average
#                     genotype of its lines (for a backcross, three quarters of one parent),
#                     ridge on that, trained on earlier families
#   within a family:  each line's deviation from its siblings, from which parental segments
#                     it inherited; one ridge trained on sibling differences in every earlier
#                     family (tester and trial effects cancel inside a family)
#
# Both train from per-cohort sufficient statistics (X'X within families, family means), so a
# forward validation for any year is a sum and a solve, and adding a year is an update.
# Targets are on the GCA scale: the tester's main effect is removed, because a line should
# not be advanced for the tester it happened to be crossed to.


@dataclass
class FamilyData:
    ids: np.ndarray              # line ids, grouped by family
    X: np.ndarray                # lines x markers, float32, same order
    families: np.ndarray         # one entry per family, sorted
    start: np.ndarray            # first row of each family in X
    counts: np.ndarray           # lines per family
    year: np.ndarray             # cohort year per family
    cluster: np.ndarray
    tester: np.ndarray
    parents: np.ndarray          # families x 2 parent ids
    Xbar: np.ndarray             # family mean genotype
    MP: np.ndarray               # midparent genotype (parents' real calls; Xbar if missing)
    y: dict                      # trait -> line values, NaN filled with the family mean
    y_raw: dict                  # trait -> line values as measured
    fmean: dict                  # trait -> family means
    W: dict                      # cohort year -> within-family X'X
    C: dict                      # cohort year -> trait -> within-family X'y

    def rows(self, fams) -> np.ndarray:
        return np.concatenate([np.arange(self.start[k], self.start[k] + self.counts[k]) for k in fams])


def family_data(h: pd.DataFrame, X: np.ndarray, P: pd.DataFrame, traits: list[str]) -> FamilyData:
    """h: lines (index = id) with family, first_year, cluster, tester, parent1/2 and trait columns,
    already restricted to genotyped lines, in the same order as the rows of X."""
    order = np.argsort(h["family"].to_numpy(), kind="stable")
    if not np.array_equal(order, np.arange(len(order))):   # skip a 2 GB copy when already grouped
        h = h.iloc[order]
        X = X[order]
    fam = h["family"].to_numpy()
    families, start, counts = np.unique(fam, return_index=True, return_counts=True)
    first = h.iloc[start]
    Xbar = np.add.reduceat(X, start, axis=0) / counts[:, None]
    pidx = {pid: k for k, pid in enumerate(P.index)}
    Pm = P.to_numpy(dtype=np.float32)
    parents = first[["parent1", "parent2"]].fillna("").to_numpy().astype(str)
    MP = np.vstack([
        np.mean([Pm[pidx[x]] for x in parents[k] if x in pidx], axis=0) if any(x in pidx for x in parents[k]) else Xbar[k]
        for k in range(len(families))
    ]).astype(np.float32)
    y, y_raw, fmean = {}, {}, {}
    for t in traits:
        v = h[t].to_numpy(dtype=np.float64)
        s = np.add.reduceat(np.nan_to_num(v), start)
        n = np.add.reduceat(np.isfinite(v).astype(float), start)
        fmean[t] = np.where(n > 0, s / np.maximum(n, 1), np.nan)
        y_raw[t] = v
        y[t] = np.where(np.isnan(v), np.repeat(fmean[t], counts), v)
    year = first["first_year"].to_numpy().astype(int)
    p = X.shape[1]
    W = {yv: np.zeros((p, p)) for yv in np.unique(year)}
    C = {yv: {t: np.zeros(p) for t in traits} for yv in np.unique(year)}
    for k in range(len(families)):
        s, n = start[k], counts[k]
        Xc = X[s:s + n] - Xbar[k]
        W[year[k]] += Xc.T @ Xc
        for t in traits:
            if np.isfinite(fmean[t][k]):   # a family never scored for a trait adds nothing
                C[year[k]][t] += Xc.T @ (y[t][s:s + n] - fmean[t][k])
    return FamilyData(
        ids=h.index.to_numpy(), X=X, families=families, start=start, counts=counts, year=year,
        cluster=first["cluster"].to_numpy().astype(str), tester=first["tester"].fillna("").to_numpy().astype(str),
        parents=parents, Xbar=Xbar, MP=MP, y=y, y_raw=y_raw, fmean=fmean, W=W, C=C,
    )


def _tester_shrinkage(y: np.ndarray, tester: np.ndarray) -> float:
    """Family variance / tester variance from a one-way random-effects ANOVA (unbalanced):
    the BLUP shrinkage for a tester effect, in families. Many testers have one or two
    families, and without this their 'effect' would be mostly their families' own merit."""
    groups: dict[str, list[float]] = {}
    for v, g in zip(y, tester):
        if g:
            groups.setdefault(g, []).append(float(v))
    N, T = sum(len(g) for g in groups.values()), len(groups)
    if T < 3 or N <= T:
        return 1e6
    m = np.array([len(g) for g in groups.values()])
    gm = np.array([np.mean(g) for g in groups.values()])
    grand = sum(sum(g) for g in groups.values()) / N
    msb = (m * (gm - grand) ** 2).sum() / (T - 1)
    msw = sum(((np.array(g) - np.mean(g)) ** 2).sum() for g in groups.values()) / (N - T)
    n0 = (N - (m ** 2).sum() / N) / (T - 1)
    s2t = (msb - msw) / n0
    return float(msw / s2t) if s2t > 0 else 1e6


def tester_effects(fd: FamilyData, t: str, use: np.ndarray) -> np.ndarray:
    """Per family: its tester's main effect (BLUP), estimated only from families in `use`.
    Zero for a tester with no families there."""
    out = np.zeros(len(fd.families))
    for cl in np.unique(fd.cluster):
        sel = np.flatnonzero(use & (fd.cluster == cl) & np.isfinite(fd.fmean[t]))
        if not len(sel):
            continue
        lam = _tester_shrinkage(fd.fmean[t][sel], fd.tester[sel])
        mu = fd.fmean[t][sel].mean()
        for T in np.unique(fd.tester[sel]):
            if not T:
                continue
            s = sel[fd.tester[sel] == T]
            out[(fd.cluster == cl) & (fd.tester == T)] = (fd.fmean[t][s] - mu).sum() / (len(s) + lam)
    return out


def within_effects(fd: FamilyData, t: str, before: int, alpha: float) -> np.ndarray:
    ys = [yv for yv in fd.W if yv < before]
    W = sum(fd.W[yv] for yv in ys)
    c = sum(fd.C[yv][t] for yv in ys)
    return np.linalg.solve(W + alpha * np.eye(W.shape[0]), c)


def between_predict(fd: FamilyData, target: np.ndarray, before: int, alpha: float,
                    half_life: float | None = 3.0) -> np.ndarray:
    """Family-level ridge on the family's mean genotype, per cluster, trained on families before
    `before`. The mean of the lines' genotypes is what the parents actually passed on: for the
    quarter of families that are backcrosses it is 3/4 one parent, which a 50/50 midparent
    misses (chosen on 2005-2007: r 0.256 -> 0.271). Weights favour families with more lines, and
    recent cohorts: linkage between markers and genes decays, so old associations transfer less."""
    train = np.flatnonzero((fd.year < before) & np.isfinite(target))
    out = np.full(len(fd.families), np.nan)
    for cl in np.unique(fd.cluster):
        tr = train[fd.cluster[train] == cl]
        if len(tr) < 5:
            continue
        w = fd.counts[tr] / (fd.counts[tr] + 20.0)
        if half_life:
            w = w * 0.5 ** ((before - 1 - fd.year[tr]) / half_life)
        mu = np.average(fd.Xbar[tr], axis=0, weights=w)
        ym = np.average(target[tr], weights=w)
        A = (fd.Xbar[tr] - mu) * np.sqrt(w)[:, None]
        a = np.linalg.solve(A @ A.T + alpha * np.eye(len(tr)), (target[tr] - ym) * np.sqrt(w))
        sel = fd.cluster == cl
        out[sel] = ym + (fd.Xbar[sel] - mu) @ (A.T @ a)
    return out


@dataclass
class CohortPrediction:
    rows: np.ndarray        # rows of fd.X / fd.ids in the cohort
    fam_index: np.ndarray   # family index per row
    between: np.ndarray     # family GCA prediction per row
    within: np.ndarray      # within-family deviation per row
    pred: np.ndarray        # between + within (after calibration)
    truth: np.ndarray       # measured value, tester effect removed (NaN if not measured)
    raw: np.ndarray         # measured value as is
    tester_effect: np.ndarray   # the tester's effect as known before `year` (for the as-planted scale)


def predict_cohort(fd: FamilyData, t: str, year: int, alpha_between: float = 3000, alpha_within: float = 1e4,
                   slope_between: float = 1.0, slope_within: float = 1.0) -> CohortPrediction:
    """Forward prediction for the families of `year`, trained only on earlier cohorts."""
    past = fd.year < year
    te_train = tester_effects(fd, t, past)                       # nothing from `year` itself
    te_truth = tester_effects(fd, t, np.ones(len(fd.families), bool))
    fam_pred = between_predict(fd, fd.fmean[t] - te_train, year, alpha_between)
    beta = within_effects(fd, t, year, alpha_within)
    fams = np.flatnonzero(fd.year == year)
    rows = fd.rows(fams)
    fam_index = np.repeat(fams, fd.counts[fams])
    within = np.concatenate([(fd.X[fd.start[k]:fd.start[k] + fd.counts[k]] - fd.Xbar[k]) @ beta for k in fams])
    between = fam_pred[fam_index]
    centre = np.nanmean(between)
    pred = centre + slope_between * (between - centre) + slope_within * within
    raw = fd.y_raw[t][rows]
    return CohortPrediction(rows=rows, fam_index=fam_index, between=between, within=within, pred=pred,
                            truth=raw - te_truth[fam_index], raw=raw, tester_effect=te_train[fam_index])


def _r(a: np.ndarray, b: np.ndarray) -> float:
    ok = np.isfinite(a) & np.isfinite(b)
    return float(np.corrcoef(a[ok], b[ok])[0, 1]) if ok.sum() > 5 and np.std(a[ok]) > 0 else float("nan")


def cohort_metrics(cp: CohortPrediction, fd: FamilyData, t: str) -> dict:
    """Predictive ability on the GCA scale, split into its between- and within-family parts."""
    ok = np.isfinite(cp.truth)
    fams = np.unique(cp.fam_index)
    fam_truth = np.array([np.nanmean(cp.truth[cp.fam_index == k]) if np.isfinite(cp.truth[cp.fam_index == k]).any() else np.nan for k in fams])
    fam_pred = np.array([cp.between[cp.fam_index == k][0] for k in fams])
    rs, ws = [], []
    for k in fams:
        m = (cp.fam_index == k) & ok
        if m.sum() > 5 and np.std(cp.within[m]) > 0:
            rs.append(np.corrcoef(cp.within[m], cp.truth[m])[0, 1]); ws.append(m.sum())
    return {
        "r": _r(cp.pred, cp.truth),
        "r_as_planted": _r(cp.pred + cp.tester_effect, cp.raw),
        "r_between": _r(fam_pred, fam_truth),
        "r_within": float(np.average(rs, weights=ws)) if rs else float("nan"),
        "top20": top_share_recovered(cp.pred[ok], cp.truth[ok]),
        "rmse": float(np.sqrt(np.nanmean((cp.pred - cp.truth) ** 2))) if ok.any() else float("nan"),
        "n_lines": int(ok.sum()), "n_families": int(len(fams)),
    }


def global_ridge_cohort(fd: FamilyData, t: str, year: int, alpha: float = 1e5) -> np.ndarray:
    """The standard baseline: one ridge over every earlier line, family structure ignored,
    raw target. Built from the same statistics: X'X = within + between-family parts."""
    tr = np.flatnonzero((fd.year < year) & np.isfinite(fd.fmean[t]))
    n = fd.counts[tr].astype(float)
    N = n.sum()
    mu = (fd.Xbar[tr] * n[:, None]).sum(0) / N
    ybar = (fd.fmean[t][tr] * n).sum() / N
    ys = [yv for yv in fd.W if yv < year]
    G = sum(fd.W[yv] for yv in ys) + (fd.Xbar[tr].T * n) @ fd.Xbar[tr] - N * np.outer(mu, mu)
    c = sum(fd.C[yv][t] for yv in ys) + fd.Xbar[tr].T @ (n * (fd.fmean[t][tr] - ybar))
    beta = np.linalg.solve(G + alpha * np.eye(G.shape[0]), c)
    rows = fd.rows(np.flatnonzero(fd.year == year))
    return ybar + (fd.X[rows] - mu) @ beta


def pedigree_cohort(fd: FamilyData, t: str, year: int, alpha: float = 10.0) -> np.ndarray:
    """Phenotypic (pedigree) BLUP: each parent's GCA from its earlier families, no markers.
    A new family is predicted as the sum of its parents' effects; unseen parents count zero."""
    past = fd.year < year
    target = fd.fmean[t] - tester_effects(fd, t, past)
    ids = sorted({x for pr in fd.parents for x in pr if x})
    ix = {x: i for i, x in enumerate(ids)}
    Z = np.zeros((len(fd.families), len(ids)))
    for k, pr in enumerate(fd.parents):
        for x in pr:
            if x in ix:
                Z[k, ix[x]] = 1.0
    out = np.zeros(len(fd.families))
    for cl in np.unique(fd.cluster):
        tr = np.flatnonzero(past & (fd.cluster == cl) & np.isfinite(target))
        w = fd.counts[tr] / (fd.counts[tr] + 20.0)
        ym = np.average(target[tr], weights=w)
        A = Z[tr] * np.sqrt(w)[:, None]
        g = np.linalg.solve(A.T @ A + alpha * np.eye(len(ids)), A.T @ ((target[tr] - ym) * np.sqrt(w)))
        sel = fd.cluster == cl
        out[sel] = ym + Z[sel] @ g
    fams = np.flatnonzero(fd.year == year)
    return np.repeat(out[fams], fd.counts[fams])


def known_parents(fd: FamilyData, year: int) -> np.ndarray:
    """Per family: how many of its two parents had a family tested before `year` (0, 1, 2).
    The honest confidence signal: with no parent on record the family mean is a genomic guess."""
    seen = {x for k in np.flatnonzero(fd.year < year) for x in fd.parents[k] if x}
    return np.array([sum(x in seen for x in pr if x) for pr in fd.parents])


def location_response_check(fd: FamilyData, plots: pd.DataFrame, year: int, alpha: float = 1e5) -> dict:
    """Can a line's location-to-location response be predicted? A genomic reaction norm: marker
    effects on a line's sensitivity to how productive a location is, fitted on plots before
    `year`, asked to predict each `year` line's deviation from its own mean at each location.

    The environment index is either the trial's actual mean ('oracle', not known in January: an
    upper bound) or the location's mean in earlier years ('history', what is known in January).
    Reduces to a weighted line-level ridge: sum over plots of w^2 x x' = sum over lines of
    (sum of that line's w^2) x x'."""
    row = {i: k for k, i in enumerate(fd.ids)}
    p = plots[plots["yield_bu"].notna() & plots["id"].isin(row.keys())].copy()
    p["envmean"] = p.groupby("env")["yield_bu"].transform("mean")
    p["ya"] = p["yield_bu"] - p["envmean"]
    p["d"] = p["ya"] - p.groupby("id")["ya"].transform("mean")
    r_ = p["id"].map(row).to_numpy(int)
    d = p["d"].to_numpy(float)
    train = (p["year"] < year).to_numpy()
    test = (p["year"] == year).to_numpy()
    out = {}
    for kind in ("oracle", "history"):
        if kind == "oracle":
            w = p["envmean"].to_numpy(float)
        else:
            past = p[train].groupby("location")["envmean"].mean()
            w = p["location"].map(past).to_numpy(float)
            w = np.where(np.isfinite(w), w, np.nanmean(past.to_numpy()))
        w = (w - w[train].mean()) / w[train].std()
        s = np.bincount(r_[train], weights=w[train] ** 2, minlength=len(fd.ids))
        t = np.bincount(r_[train], weights=(w * d)[train], minlength=len(fd.ids))
        rows = np.flatnonzero(s > 0)
        G = np.zeros((fd.X.shape[1], fd.X.shape[1]))
        c = np.zeros(fd.X.shape[1])
        for i0 in range(0, len(rows), 8000):          # chunks keep the temporaries small
            rr = rows[i0:i0 + 8000]
            Xc = fd.X[rr]
            G += (Xc.T * s[rr]) @ Xc
            c += Xc.T @ t[rr]
        beta = np.linalg.solve(G + alpha * np.eye(G.shape[0]), c)
        lines = np.unique(r_[test])
        slope = np.zeros(len(fd.ids))
        slope[lines] = fd.X[lines] @ beta           # one sensitivity per line, then per plot
        out[kind] = _r(w[test] * slope[r_[test]], d[test])
    out["n_plots"] = int(test.sum())
    out["sd_within_line"] = float(np.nanstd(d[test]))
    return out


def trial_reliability(plots: pd.DataFrame, trait: str = "yield_bu", min_lines: int = 30) -> pd.DataFrame:
    """How much one plot at a trial tells you about a line: per trial (year x location x cluster),
    the correlation between each line's trial-adjusted result there and its average at its other
    locations. Computed from sums, so it is one pass over a million plots."""
    p = plots[plots[trait].notna()].copy()
    p["ya"] = p[trait] - p.groupby("env")[trait].transform("mean")
    g = p.groupby("id")["ya"]
    p["s"], p["n"] = g.transform("sum"), g.transform("count")
    p = p[p["n"] >= 3].copy()
    p["other"] = (p["s"] - p["ya"]) / (p["n"] - 1)
    x, y, e = p["ya"], p["other"], p["env"]
    agg = pd.DataFrame({"n": p.groupby("env").size(), "sx": x.groupby(e).sum(), "sy": y.groupby(e).sum(),
                        "sxx": (x * x).groupby(e).sum(), "syy": (y * y).groupby(e).sum(), "sxy": (x * y).groupby(e).sum()})
    num = agg.sxy - agg.sx * agg.sy / agg.n
    den = np.sqrt((agg.sxx - agg.sx ** 2 / agg.n) * (agg.syy - agg.sy ** 2 / agg.n))
    agg["r"] = num / den
    agg = agg.join(p.drop_duplicates("env").set_index("env")[["year", "location", "cluster"]])
    agg["trial_mean"] = plots[plots[trait].notna()].groupby("env")[trait].mean()
    return agg[agg["n"] >= min_lines]


def _wr(a: np.ndarray, b: np.ndarray, w: np.ndarray) -> float:
    a, b = a - np.average(a, weights=w), b - np.average(b, weights=w)
    return float(np.sum(w * a * b) / np.sqrt(np.sum(w * a * a) * np.sum(w * b * b)))


def _family_cells(fd: FamilyData, plots: pd.DataFrame) -> pd.DataFrame:
    """One row per family x trial: the family's mean yield there, raw and relative to the trial."""
    fams = set(fd.families)
    p = plots[plots["yield_bu"].notna() & plots["family"].isin(fams)].copy()
    p["ya"] = p["yield_bu"] - p.groupby("env")["yield_bu"].transform("mean")
    return p.groupby(["family", "env"]).agg(y=("yield_bu", "mean"), c=("ya", "mean"), n=("ya", "size"),
                                            year=("year", "first"), cluster=("cluster", "first"),
                                            location=("location", "first"), lat=("lat", "mean"),
                                            lon=("lon", "mean")).reset_index()


def family_climate_check(fd: FamilyData, plots: pd.DataFrame, env: pd.DataFrame, years: list[int],
                         n_pcs: int = 20, alpha: float = 1e4) -> dict:
    """Can parent DNA x weather and soil say which family does better where? A family-level reaction
    norm: each family's deviation at each trial from its own average, regressed on (family genotype
    PCs) x (the trial's covariates), trained on earlier seasons and scored on each new one. The
    covariates come two ways: the season's real weather (not known in January, an upper bound) and
    each location's average of earlier seasons (what is known in January). Soil is the same in both."""
    fi = {f: k for k, f in enumerate(fd.families)}
    cell = _family_cells(fd, plots)
    cell = cell[cell["n"] >= 5].copy()
    tot = cell.assign(w=cell["c"] * cell["n"]).groupby("family")[["w", "n"]].sum()
    cell["d"] = cell["c"] - cell["family"].map(tot["w"] / tot["n"])
    # is the interaction real inside a season? the same deviations from two random halves of each family
    p = plots[plots["yield_bu"].notna() & plots["family"].isin(fi.keys())].copy()
    p["ya"] = p["yield_bu"] - p.groupby("env")["yield_bu"].transform("mean")
    ids = p["id"].unique()
    half = pd.Series(np.random.default_rng(0).integers(0, 2, len(ids)), index=ids)
    hc = p.assign(h=p["id"].map(half)).groupby(["family", "env", "h"])["ya"].agg(["mean", "size"]).unstack("h")
    hc = hc[(hc[("size", 0)] >= 3) & (hc[("size", 1)] >= 3)]
    dev = [hc[("mean", k)] - hc[("mean", k)].groupby("family").transform("mean") for k in (0, 1)]
    split_half = _r(dev[0].to_numpy(), dev[1].to_numpy())
    Z = fd.Xbar - fd.Xbar.mean(0)
    U, s, _ = np.linalg.svd(Z, full_matrices=False)
    pcs = U[:, :n_pcs] * s[:n_pcs]
    pcs = (pcs - pcs.mean(0)) / pcs.std(0)
    e = env.copy()
    e["rain_summer"] = e[["X06_PRCP", "X07_PRCP", "X08_PRCP"]].sum(axis=1)
    e["rain_spring"] = e[["X04_PRCP", "X05_PRCP"]].sum(axis=1)
    e["heat_summer"] = e[["X06_CLDD", "X07_CLDD", "X08_CLDD"]].sum(axis=1)
    e["wet_days"] = e[["X06_DP10", "X07_DP10", "X08_DP10"]].sum(axis=1)
    cols = ["rain_summer", "rain_spring", "heat_summer", "X07_TAVG", "wet_days",
            "clay_0_5cm", "sand_0_5cm", "soc_0_5cm", "phh2o_0_5cm", "nitrogen_0_5cm"]
    actual = e.set_index(["YEAR", "LOC"])[cols]
    out: dict = {"actual": [], "typical": []}
    for y in years:
        for kind in ("actual", "typical"):
            ec = actual if kind == "actual" else e[e["YEAR"] < y].groupby("LOC")[cols].mean()
            def feats(c: pd.DataFrame) -> np.ndarray:
                E = (c[["year", "location"]].join(ec, on=["year", "location"]) if kind == "actual"
                     else c[["location"]].join(ec, on="location"))
                return np.c_[E[cols].to_numpy(float), c[["lat", "lon"]].to_numpy(float)]
            tr, te = cell[cell["year"] < y], cell[cell["year"] == y]
            Etr, Ete = feats(tr), feats(te)
            ktr, kte = np.isfinite(Etr).all(1), np.isfinite(Ete).all(1)
            tr, Etr, te, Ete = tr[ktr], Etr[ktr], te[kte], Ete[kte]
            mu, sd = Etr.mean(0), Etr.std(0) + 1e-9
            Etr, Ete = (Etr - mu) / sd, (Ete - mu) / sd
            Ptr, Pte = pcs[tr["family"].map(fi).to_numpy()], pcs[te["family"].map(fi).to_numpy()]
            Ftr = (Ptr[:, :, None] * Etr[:, None, :]).reshape(len(tr), -1)
            Fte = (Pte[:, :, None] * Ete[:, None, :]).reshape(len(te), -1)
            w = np.minimum(tr["n"].to_numpy(float), 60.0)
            b = np.linalg.solve(Ftr.T @ (Ftr * w[:, None]) + alpha * np.eye(Ftr.shape[1]), Ftr.T @ (w * tr["d"].to_numpy()))
            out[kind].append(_wr(Fte @ b, te["d"].to_numpy(), np.minimum(te["n"].to_numpy(float), 60.0)))
    return {"r_actual": float(np.mean(out["actual"])), "r_typical": float(np.mean(out["typical"])),
            "by_year_typical": [round(v, 3) for v in out["typical"]], "cells": int(len(cell)), "split_half": split_half}


def joint_trial_check(fd: FamilyData, plots: pd.DataFrame, years: list[int], alpha: float = 1e4) -> dict:
    """Trials hold only a few families each, so each family is compared with the families grown
    beside it. The textbook alternative fits every trial and family together, comparing families
    across the whole season through shared locations. This asks whether that is better, and why
    not: how much of a family's joint estimate is simply where it was tested (and DNA predicts where
    breeders test a family, since placement follows adaptation)."""
    from scipy import sparse
    from scipy.sparse.linalg import lsqr
    cell = _family_cells(fd, plots)
    fam = cell.groupby("family").agg(year=("year", "first"), cluster=("cluster", "first"))
    near = (cell.assign(w=cell["c"] * cell["n"]).groupby("family")["w"].sum() / cell.groupby("family")["n"].sum())
    joint = pd.Series(np.nan, index=near.index)
    for _, d in cell.groupby(["year", "cluster"]):
        envs, fs = pd.factorize(d["env"])[0], pd.factorize(d["family"])
        r = np.arange(len(d))
        A = sparse.hstack([sparse.csr_matrix((np.ones(len(d)), (r, envs)), shape=(len(d), envs.max() + 1)),
                           sparse.csr_matrix((np.ones(len(d)), (r, fs[0])), shape=(len(d), len(fs[1])))]).tocsr()
        w = np.sqrt(d["n"].to_numpy(float))
        sol = lsqr(sparse.diags(w) @ A, w * d["y"].to_numpy(), damp=1e-3, atol=1e-10, btol=1e-10, iter_lim=20000)[0]
        fe = sol[envs.max() + 1:]
        joint.loc[list(fs[1])] = fe - fe.mean()
    key = fam["year"].astype(str) + fam["cluster"].astype(str)
    near = near - near.groupby(key).transform("mean")
    site = cell.assign(wl=cell["lat"] * cell["n"], wo=cell["lon"] * cell["n"]).groupby("family")[["wl", "wo", "n"]].sum()
    lat = (site["wl"] / site["n"]); lon = (site["wo"] / site["n"])
    lat, lon = lat - lat.groupby(key).transform("mean"), lon - lon.groupby(key).transform("mean")
    L = np.c_[np.ones(len(lat)), lat.to_numpy(), lon.to_numpy()]
    ok = np.isfinite(L).all(1)
    beta = np.linalg.lstsq(L[ok], joint.to_numpy()[ok], rcond=None)[0]
    joint_site = joint.copy()
    joint_site[ok] = joint.to_numpy()[ok] - L[ok] @ beta
    joint_site[~ok] = np.nan
    fi = {f: k for k, f in enumerate(fd.families)}
    Zs = (fd.Xbar - fd.Xbar.mean(0)) / (fd.Xbar.std(0) + 1e-6)
    def forward(target: pd.Series) -> list[float]:
        t = np.full(len(fd.families), np.nan)
        idx = [fi[f] for f in target.index if f in fi]
        t[idx] = target[[f for f in target.index if f in fi]].to_numpy()
        res = []
        for y in years:
            tr = np.flatnonzero((fd.year < y) & np.isfinite(t)); te = np.flatnonzero((fd.year == y) & np.isfinite(t))
            a = np.linalg.solve(Zs[tr] @ Zs[tr].T + alpha * np.eye(len(tr)), t[tr] - t[tr].mean())
            res.append(_r(Zs[te] @ (Zs[tr].T @ a), t[te]))
        return res
    both = near.index.intersection(joint.index)
    return {"r_near_joint": _r(near[both].to_numpy(), joint[both].to_numpy()),
            "lat_corr_near": _r(lat[both].to_numpy(), near[both].to_numpy()),
            "lat_corr_joint": _r(lat[both].to_numpy(), joint[both].to_numpy()),
            "dna_predicts_site": forward(lat),
            "fwd_near": forward(near), "fwd_joint": forward(joint), "fwd_joint_site": forward(joint_site)}
