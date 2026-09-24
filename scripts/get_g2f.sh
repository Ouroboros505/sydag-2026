#!/usr/bin/env bash
# Fetch the public Genomes to Fields competition data (~80 MB, no login) into data/raw/g2f/,
# the stand-in dataset the pipeline runs on until the challenge files arrive.
#   bash scripts/get_g2f.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://data.cyverse.org/dav-anon/iplant/projects/commons_repo/curated/GenomesToFields_GenotypeByEnvironment_PredictionCompetition_2025"
mkdir -p data/raw/g2f/Training_data data/raw/g2f/Testing_data
for f in \
  Training_data/1_Training_Trait_Data_2014_2023.csv \
  Training_data/2_Training_Meta_Data_2014_2023.csv \
  Training_data/5_Genotype_Data_All_2014_2025_Hybrids_numerical.txt \
  Testing_data/1_Submission_Template_2024.csv \
  Testing_data/7_Testing_Observed_Values.csv ; do
  out="data/raw/g2f/$f"
  [ -s "$out" ] && { echo "have  $f"; continue; }
  echo "fetch $f"; curl -sSL --retry 3 -o "$out" "$BASE/$f"
done
echo "done: $(du -sh data/raw/g2f | cut -f1) in data/raw/g2f/"
