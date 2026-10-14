#!/bin/sh
set -e
cd "$(dirname "$0")"
{
  cat src/head.html
  echo '<script>'
  echo "'use strict';"
  cat src/registry.js src/glsl.js src/assets.js src/identity.js src/sketch.js src/data_samples.js src/data.js src/thumbs.js src/language.js src/modules/custom.js
  cat src/modules/sources_transitions.js src/modules/mix_generators.js src/modules/treatments.js src/modules/effects_overlays.js src/modules/data_viz.js src/modules/data_viz2.js src/modules/image_tools.js src/modules/print_modules.js src/modules/creative.js src/modules/textures_fx.js src/modules/library2.js src/modules/library3.js src/modules/simulation.js src/modules/svg_fx.js src/modules/library4.js src/modules/library5.js src/modules/data_viz3.js src/modules/svg_fx2.js src/modules/tr_blend.js src/modules/tr_wipes.js src/modules/tr_moves.js src/modules/tr_panels.js src/modules/tr_3d.js src/modules/tr_warp.js src/modules/tr_signal.js src/modules/tr_physics.js src/modules/tr_craft.js src/modules/tr_systems.js src/modules/tr_cinema.js src/modules/tr_maths.js src/modules/tr_life.js src/modules/tr_matter.js src/modules/tr_sky.js src/modules/tr_machine.js src/modules/tr_reading.js src/modules/tr_space.js src/print.js
  cat src/vendor/mp4-muxer.min.js
  cat src/engine.js src/app.js src/assets_ui.js src/system_ui.js src/workspace_ui.js src/data_ui.js src/arena.js src/language_ui.js src/print_ui.js src/main.js
  echo '</script>'
} > dist/.body.html
python3 - <<'PY'
import base64, gzip, pathlib
d = pathlib.Path('dist')
body = (d / '.body.html').read_text()
core = body + '</body>\n</html>\n'
blob = base64.b64encode(gzip.compress(core.encode('utf-8'), 9, mtime=0)).decode()
(d / 'fxlab.html').write_text(body + '<script>window.__FXLAB_SELF="' + blob + '";</script>\n</body>\n</html>\n')
PY
rm -f dist/.body.html
cp dist/fxlab.html dist/index.html
wc -c dist/fxlab.html
