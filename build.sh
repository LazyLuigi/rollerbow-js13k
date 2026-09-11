#!/usr/bin/env bash
# js13kGames + Wavedash build chain: extraction -> terser -> roadroller -> zip -> advzip.
#
#   ./build.sh                      # builds src/index.html
#   ./build.sh --best 6             # 6 roadroller draws, keeps the smallest
#
# Outputs:
#   rollerbow.zip            contest archive, index.html at its root
#   dist/js13k/index.html    compressed page, the one that is in the zip
#   dist/wavedash/index.html non-minified page, target of the Wavedash challenge
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
[ -f "$SRC" ] || { echo "Source not found: $SRC"; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p dist/js13k dist/wavedash

# --- tools ---
if [ ! -x ./node_modules/.bin/terser ] || [ ! -x ./node_modules/.bin/roadroller ]; then
  echo "Installing terser and roadroller..."
  npm install --silent
fi
TERSER=./node_modules/.bin/terser
ROADROLLER=./node_modules/.bin/roadroller

# --- 1. extraction of the <script> and the <style> ---
python3 - "$SRC" "$WORK" <<'PY'
import re, sys
src, work = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
m = re.search(r'<script>(.*)</script>', html, re.S)
if not m:
    sys.exit("No <script> block found in " + src)
open(work + '/game.js', 'w', encoding='utf-8').write(m.group(1))
sm = re.search(r'<style>(.*?)</style>', html, re.S)
open(work + '/style.css', 'w', encoding='utf-8').write(sm.group(1) if sm else '')
PY

# --- 2. syntax check then minification ---
# No booleans_as_integers: it rewrites true as 1 and the Wavedash SDK
# validates its types, so every call would be rejected silently.
node --check "$WORK/game.js" && echo "JS syntax  : OK"
"$TERSER" "$WORK/game.js" -c passes=3,unsafe=true -m toplevel=true -o "$WORK/game.min.js"
echo "terser     : $(wc -c < "$WORK/game.min.js") bytes"

# --- 3. roadroller: its parameter search is random, so we draw
#        several times and keep the best sample. ---
BESTN=0
for i in $(seq 1 "$BEST"); do
  "$ROADROLLER" "$WORK/game.min.js" -o "$WORK/cand.js" 2>/dev/null
  N=$(wc -c < "$WORK/cand.js")
  if [ "$BESTN" -eq 0 ] || [ "$N" -lt "$BESTN" ]; then BESTN=$N; cp "$WORK/cand.js" "$WORK/game.rr.js"; fi
  [ "$BEST" -gt 1 ] && echo "  draw $i : $N bytes"
done
echo "roadroller : $BESTN bytes"

# --- 4. minimal HTML rebuilt around the compressed JS ---
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

# --- 5. zip -9 then zopfli recompression: identical content, smaller container ---
( cd "$WORK" && zip -9 -q out.zip index.html )
if command -v advzip >/dev/null 2>&1; then
  Z9=$(wc -c < "$WORK/out.zip")
  advzip -z -4 -q "$WORK/out.zip"
  echo "zip -9     : $Z9 bytes  ->  advzip : $(wc -c < "$WORK/out.zip") bytes"
else
  echo "advzip missing: archive not recompressed (brew install advancecomp)"
fi
unzip -t -qq "$WORK/out.zip"

Z=$(wc -c < "$WORK/out.zip")
echo "----------------------------------------"
echo "ZIP : $Z / $LIMIT bytes"
if [ "$Z" -gt "$LIMIT" ]; then echo "OVER BUDGET by $((Z - LIMIT)) bytes."; exit 1; fi

# The deliverables are only replaced once the archive is verified and within budget.
cp "$WORK/index.html" dist/js13k/index.html
cp "$WORK/out.zip"    "$ZIP"
cp "$SRC"             dist/wavedash/index.html

echo "WITHIN BUDGET. Margin: $((LIMIT - Z)) bytes."
echo "  $ZIP                     to submit"
echo "  dist/js13k/index.html    the page in the zip"
echo "  dist/wavedash/index.html Wavedash target, not compressed"
