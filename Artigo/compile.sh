#!/bin/sh
# Compile paper.tex with latexmk (generated files in build/) and copy the PDF to paper.pdf, the
# copy kept in the repository. Runs from any directory: sh Artigo/compile.sh
set -e
cd "$(dirname "$0")"

# The latexmk on the PATH, or else that of a TeX Live installed in the user's home (~/texlive).
if ! command -v latexmk >/dev/null 2>&1; then
    for dir in "$HOME"/texlive/*/bin/*; do
        if [ -x "$dir/latexmk" ]; then PATH="$dir:$PATH"; fi
    done
fi
if ! command -v latexmk >/dev/null 2>&1; then
    echo "latexmk not found: install a TeX distribution such as TeX Live" >&2
    exit 1
fi

latexmk -interaction=nonstopmode paper.tex
cp build/paper.pdf paper.pdf
pages=$(sed -n 's/^Output written on build\/paper.pdf (\([0-9]*\) pages.*/\1/p' build/paper.log)
echo "Artigo/paper.pdf: $pages pages"
if [ "${pages:-0}" -gt 20 ]; then
    echo "Warning: more than 20 pages, the limit of the assignment" >&2
fi
