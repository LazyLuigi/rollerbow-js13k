#!/usr/bin/env bash
# Chaine de build js13kGames + Wavedash : extraction -> terser -> roadroller -> zip -> advzip.
#
#   ./build.sh                      # construit src/index.html
#   ./build.sh --best 6             # 6 tirages roadroller, garde le plus petit
#   ./build.sh src/v1-skates.html   # variante patins a roulettes
#
# Sorties :
#   rollerbow.zip            archive du concours, index.html a sa racine
#   dist/js13k/index.html    page compressee, celle qui est dans le zip
#   dist/wavedash/index.html page non minifiee, cible du challenge Wavedash
set -euo pipefail

SRC=""; BEST=1
while [ $# -gt 0 ]; do
  case "$1" in
    --best) BEST="$2"; shift 2 ;;
    *) SRC="$1"; shift ;;
  esac
done
SRC="${SRC:-src/index.html}"
LIMIT=13312                       # 13 * 1024
ZIP=rollerbow.zip
[ -f "$SRC" ] || { echo "Source introuvable : $SRC"; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p dist/js13k dist/wavedash

# --- outils ---
if [ ! -x ./node_modules/.bin/terser ] || [ ! -x ./node_modules/.bin/roadroller ]; then
  echo "Installation de terser et roadroller..."
  npm install --silent
fi
TERSER=./node_modules/.bin/terser
ROADROLLER=./node_modules/.bin/roadroller

# --- 1. extraction du <script> et du <style> ---
python3 - "$SRC" "$WORK" <<'PY'
import re, sys
src, work = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
m = re.search(r'<script>(.*)</script>', html, re.S)
if not m:
    sys.exit("Aucun bloc <script> trouve dans " + src)
open(work + '/game.js', 'w', encoding='utf-8').write(m.group(1))
sm = re.search(r'<style>(.*?)</style>', html, re.S)
open(work + '/style.css', 'w', encoding='utf-8').write(sm.group(1) if sm else '')
PY

# --- 2. verification de syntaxe puis minification ---
# Pas de booleans_as_integers : il reecrit true en 1 et le SDK Wavedash
# valide ses types, donc tous les appels seraient rejetes en silence.
node --check "$WORK/game.js" && echo "Syntaxe JS : OK"
"$TERSER" "$WORK/game.js" -c passes=3,unsafe=true -m toplevel=true -o "$WORK/game.min.js"
echo "terser     : $(wc -c < "$WORK/game.min.js") octets"

# --- 3. roadroller : sa recherche de parametres est aleatoire, donc on tire
#        plusieurs fois et on garde le meilleur echantillon. ---
BESTN=0
for i in $(seq 1 "$BEST"); do
  "$ROADROLLER" "$WORK/game.min.js" -o "$WORK/cand.js" 2>/dev/null
  N=$(wc -c < "$WORK/cand.js")
  if [ "$BESTN" -eq 0 ] || [ "$N" -lt "$BESTN" ]; then BESTN=$N; cp "$WORK/cand.js" "$WORK/game.rr.js"; fi
  [ "$BEST" -gt 1 ] && echo "  tirage $i : $N octets"
done
echo "roadroller : $BESTN octets"

# --- 4. HTML minimal reconstruit autour du JS compresse ---
python3 - "$WORK" <<'PY'
import sys
work = sys.argv[1]
css = open(work + '/style.css', encoding='utf-8').read().strip()
js  = open(work + '/game.rr.js', encoding='utf-8').read()
style = ('<style>' + css + '</style>') if css else ''
open(work + '/index.html', 'w', encoding='utf-8').write(
    '<!doctype html><meta charset=utf-8><title>ROLLERBOW</title>'
    + style + '<canvas id=c></canvas><script>' + js + '</script>')
PY

# --- 5. zip -9 puis recompression zopfli : contenu identique, conteneur plus petit ---
( cd "$WORK" && zip -9 -q out.zip index.html )
if command -v advzip >/dev/null 2>&1; then
  Z9=$(wc -c < "$WORK/out.zip")
  advzip -z -4 -q "$WORK/out.zip"
  echo "zip -9     : $Z9 octets  ->  advzip : $(wc -c < "$WORK/out.zip") octets"
else
  echo "advzip absent : archive non recompressee (brew install advancecomp)"
fi
unzip -t -qq "$WORK/out.zip"

Z=$(wc -c < "$WORK/out.zip")
echo "----------------------------------------"
echo "ZIP : $Z / $LIMIT octets"
if [ "$Z" -gt "$LIMIT" ]; then echo "DEPASSEMENT de $((Z - LIMIT)) octets."; exit 1; fi

# Les livrables ne sont remplaces qu'une fois l'archive verifiee et dans le budget.
cp "$WORK/index.html" dist/js13k/index.html
cp "$WORK/out.zip"    "$ZIP"
cp "$SRC"             dist/wavedash/index.html

echo "DANS LE BUDGET. Marge : $((LIMIT - Z)) octets."
echo "  $ZIP                     a soumettre"
echo "  dist/js13k/index.html    la page du zip"
echo "  dist/wavedash/index.html cible Wavedash, non compressee"
