"""Data files of the IAês site (site/public/dados/), from the analysis outputs and the corpus.

    meta         dados/meta.json: the partial year's last month and when the data was built
    palavras     dados/palavras/<lang>/: search index, yearly series and sentences in context
    mapa         dados/mapa/: every tested word of the last full year, per language and area
    areas        dados/areas.json: marker index and lower bound per field and year
    pares        dados/pares/: the same papers' Portuguese and English abstracts
    experimento  dados/experimento/: the rewriting experiment
    raiox        dados/marcadoras.json and dados/jogo.json: marker list, histograms and the game
    inicio       dados/inicio.json: the home page's numbers and opening words
    all          every step above, in order
    check        compare the site data with analysis/report.json and the excess tables

Standard library only; run with `python3 -I`. Needs data/interim/ (scripts/excess.py prepare and
scripts/pairs.py prepare) and the raw Crossref files for the sentences in context. The output is
committed, since the site's build cannot see data/. The data contract is site/DADOS.md.
"""

import argparse
import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

STEPS = ("meta", "palavras", "mapa", "areas", "pares", "experimento", "raiox", "inicio")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("step", choices=(*STEPS, "all", "check"))
    args = parser.parse_args()
    for step in STEPS if args.step == "all" else (args.step,):
        importlib.import_module(f"site_data.{step}").build()


if __name__ == "__main__":
    main()
