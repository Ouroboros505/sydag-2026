# Installs the R toolkit into the user library. Run once:
#   Rscript R/setup.R
#
# Slow the first time (tidyverse compiles). Leave it running in another terminal.

lib <- Sys.getenv("R_LIBS_USER")
if (lib == "" || is.na(lib)) lib <- file.path(Sys.getenv("HOME"), "R", "library")
dir.create(lib, recursive = TRUE, showWarnings = FALSE)
.libPaths(lib)

options(repos = c(CRAN = "https://cloud.r-project.org"))

pkgs <- c(
  # core
  "tidyverse", "data.table", "janitor", "here", "conflicted",
  # viz
  "ggplot2", "patchwork", "cowplot", "ggiraph", "scales", "viridis",
  # models
  "tidymodels", "broom", "lme4", "forecast",
  # spatial
  "sf", "terra", "stars",
  # io / reporting
  "arrow", "readxl", "writexl", "jsonlite", "knitr", "rmarkdown"
)

missing <- setdiff(pkgs, rownames(installed.packages(lib.loc = lib)))
if (length(missing)) {
  message("installing: ", paste(missing, collapse = ", "))
  install.packages(missing, lib = lib, Ncpus = max(1, parallel::detectCores() - 1))
} else {
  message("all packages already present")
}

ok <- vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)
if (any(!ok)) message("FAILED: ", paste(pkgs[!ok], collapse = ", ")) else message("R toolkit ready")
