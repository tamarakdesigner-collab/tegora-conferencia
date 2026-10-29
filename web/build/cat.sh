#!/bin/bash
cd /home/claude/tegora
cat src/core.js src/gfx.js src/logo.js src/draw.js src/pdf.js $( [ -f src/dxf.js ] && echo src/dxf.js ) > out/engine.js
