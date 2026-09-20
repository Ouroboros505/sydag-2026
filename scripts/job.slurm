#!/bin/bash
#SBATCH --job-name=sydag
#SBATCH --account=CHANGEME
#SBATCH --partition=shared
#SBATCH --nodes=1
#SBATCH --ntasks=8
#SBATCH --time=02:00:00
#SBATCH --output=logs/%x-%j.out

module load anaconda
conda activate sydag
cd "$SLURM_SUBMIT_DIR"
python -u "$@"
