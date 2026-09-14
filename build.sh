#!/bin/sh
set -e
cd "$(dirname "$0")"
{
  cat src/head.html
  echo '<script>'
  echo "'use strict';"
  cat src/registry.js src/glsl.js src/assets.js src/identity.js src/kt.js src/glyphs.js src/modules/custom.js
  cat src/modules/sources_transitions.js src/modules/mix_generators.js src/modules/treatments.js src/modules/effects_overlays.js src/modules/kinetic_type.js src/modules/kinetic_type2.js src/modules/kinetic_type3.js src/modules/kinetic_type4.js src/modules/logo_brand.js src/modules/logo_brand2.js src/modules/print_modules.js src/modules/creative.js src/modules/textures_fx.js src/modules/library2.js src/looks.js src/print.js
  cat src/vendor/mp4-muxer.min.js
  cat src/engine.js src/app.js src/assets_ui.js src/system_ui.js src/print_ui.js src/main.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > dist/fxlab.html
cp dist/fxlab.html dist/index.html
wc -c dist/fxlab.html
