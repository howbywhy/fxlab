"""Poster mode: layers in, move/scale/rotate, blend, an FX Lab effect on an image,
undo, export, save and open, and that Motion is left as it was.

    python3 tests/poster.py
"""
import base64, json, sys, tempfile, pathlib
from playwright.sync_api import sync_playwright
from helpers import launch, report

# a 64×40 two-tone PNG and a transparent 32×32 with an opaque centre, made in the page
MAKE = """async ([w, h, alpha]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (alpha){ x.fillStyle = '#20a070'; x.fillRect(w / 4, h / 4, w / 2, h / 2); } else { x.fillStyle = '#d04020'; x.fillRect(0, 0, w / 2, h); x.fillStyle = '#2040d0'; x.fillRect(w / 2, 0, w / 2, h); }
  return c.toDataURL('image/png'); }"""


def run():
    bad = []
    tmp = pathlib.Path(tempfile.mkdtemp())
    with sync_playwright() as p:
        browser, page, errors = launch(p, viewport=(1280, 800), downloads=True)
        f = page.evaluate
        files = []
        for name, args in [('wide.png', [640, 400, False]), ('cut.png', [320, 320, True])]:
            data = f(MAKE, args).split(',', 1)[1]
            (tmp / name).write_bytes(base64.b64decode(data)); files.append(str(tmp / name))
        motion_before = f("() => JSON.stringify(window.fxlab.projectFromState(true))")

        page.click('#modePoster'); page.wait_for_timeout(300)
        vis = f("() => ({ poster:getComputedStyle(document.getElementById('poster')).display, motionPanel:getComputedStyle(document.getElementById('panel')).visibility, empty:!document.getElementById('pEmpty').hidden })")
        if vis != {'poster': 'grid', 'motionPanel': 'hidden', 'empty': True}: bad.append(f'switching to Poster: {vis}')

        page.set_input_files('#pFile', files); page.wait_for_timeout(600)
        page.click('#pAddText'); page.click('#pAddRect')
        types = f("() => window.fxlab.Poster.P.doc.layers.map(l => l.type)")
        if types != ['image', 'image', 'text', 'shape']: bad.append(f'layers after adding: {types}')
        if f("() => document.querySelectorAll('#pLayers .player-row').length") != 4: bad.append('layer list does not show four rows')

        # drag the selected rectangle by 100 screen px and check it moved by 100 / zoom
        k = f("() => window.fxlab.Poster.P.view.k")
        box = page.locator('#pStage').bounding_box()
        x0 = f("() => window.fxlab.Poster.P.doc.layers[3].x")
        cx, cy = box['x'] + box['width'] / 2 + 30, box['y'] + box['height'] / 2 + 30
        page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 100, cy, steps=4); page.mouse.up()
        x1 = f("() => window.fxlab.Poster.P.doc.layers[3].x")
        if abs((x1 - x0) - 100 / k) > 2: bad.append(f'drag moved {x1 - x0:.1f}, expected {100 / k:.1f}')
        page.keyboard.press('Control+z')
        if abs(f("() => window.fxlab.Poster.P.doc.layers[3].x") - x0) > .01: bad.append('undo did not put the rectangle back')
        page.keyboard.press('Shift+ArrowRight')
        if abs(f("() => window.fxlab.Poster.P.doc.layers[3].x") - x0 - 10) > .01: bad.append('Shift+arrow did not nudge 10 px')

        # typed position, blend, an effect on the first image
        f("() => window.fxlab.Poster.select(window.fxlab.Poster.P.doc.layers[0].id)")
        page.fill('input[aria-label="Rotate °"]', '30'); page.locator('input[aria-label="Rotate °"]').dispatch_event('change')
        if f("() => window.fxlab.Poster.P.doc.layers[0].rot") != 30: bad.append('typed rotation was not applied')
        page.select_option('select[aria-label="Blend"]', 'multiply')
        page.select_option('select[aria-label="Add an effect"]', 'trt-halftone'); page.wait_for_timeout(600)
        f("() => window.fxlab.Poster.bakeAll()")
        fx = f("() => window.fxlab.Poster.P.doc.layers[0].fx.map(i => i.id)")
        if fx != ['trt-halftone']: bad.append(f'effect list {fx}')

        # export: full size, the effect changes the pixels, transparency survives in PNG
        with page.expect_download() as d: page.click('#pExport')
        out = tmp / 'out.png'; d.value.save_as(out)
        dims = f("async (u) => { const i = new Image(); i.src = u; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }", 'data:image/png;base64,' + base64.b64encode(out.read_bytes()).decode())
        if dims != [1080, 1350]: bad.append(f'export size {dims}')
        changed = f("""() => { const P = window.fxlab.Poster, c = document.createElement('canvas'); c.width = 270; c.height = 338;
          P.drawDoc(c.getContext('2d'), .25); const a = c.getContext('2d').getImageData(0, 0, 270, 338).data;
          const L = P.P.doc.layers[0]; L.fx[0].on = false; P.drawDoc(c.getContext('2d'), .25); const b = c.getContext('2d').getImageData(0, 0, 270, 338).data; L.fx[0].on = true;
          let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 24) n++; return n; }""")
        if changed < 200: bad.append(f'the halftone changed only {changed} px')
        f("() => { window.fxlab.Poster.P.doc.transparent = true; }")
        corner = f("""() => { const c = document.createElement('canvas'); c.width = 108; c.height = 135; window.fxlab.Poster.drawDoc(c.getContext('2d'), .1); return c.getContext('2d').getImageData(1, 1, 1, 1).data[3]; }""")
        if corner != 0: bad.append(f'transparent poster corner alpha {corner}')

        # save, clear, open: same layers back, with their pictures
        with page.expect_download() as d: page.click('#pSave')
        saved = tmp / 'p.fxposter.json'; d.value.save_as(saved)
        doc = json.loads(saved.read_text())
        if len(doc.get('media', {})) != 2: bad.append(f"saved file carries {len(doc.get('media', {}))} images")
        f("() => { window.fxlab.Poster.P.doc.layers = []; }")
        page.set_input_files('#pFileProject', str(saved)); page.wait_for_timeout(800)
        back = f("() => window.fxlab.Poster.P.doc.layers.map(l => l.type + (l.type === 'image' ? ':' + !!window.fxlab.Poster.P.media[l.image.media] : ''))")
        if back != ['image:true', 'image:true', 'text', 'shape']: bad.append(f'opened poster {back}')

        # every poster control has a name
        un = f("""() => [...document.querySelectorAll('#poster input:not([type=hidden]), #poster select, #poster textarea, #poster button, #top button')]
          .filter(e => e.offsetParent !== null).filter(e => {
            const name = e.getAttribute('aria-label') || e.title || e.dataset.tip || (e.labels && e.labels.length && e.labels[0].textContent.trim()) || (e.tagName === 'BUTTON' && e.textContent.trim()) || (e.closest('label') && e.closest('label').textContent.trim());
            return !name; }).map(e => e.tagName + '#' + e.id + '.' + e.className).slice(0, 5)""")
        if un: bad.append(f'unnamed poster controls {un}')
        if f("() => document.documentElement.scrollWidth") > 1280: bad.append('poster mode scrolls sideways at 1280')

        # back to Motion: nothing in the motion project changed, and it renders
        page.click('#modeMotion'); page.wait_for_timeout(300)
        if f("() => JSON.stringify(window.fxlab.projectFromState(true))") != motion_before: bad.append('Poster changed the Motion project')
        if f("() => getComputedStyle(document.getElementById('poster')).display") != 'none': bad.append('Poster still showing in Motion')
        page.keyboard.press('2')
        if f("() => document.querySelector('.ws.on').id") != 'wsCombine': bad.append('number keys stopped switching Motion tabs')
        browser.close()
        bad += [e for e in errors if 'favicon' not in e]
    return bad


def collage():
    """Cut-outs, edges, clipping, marks, merge, and that a mask survives save and open."""
    bad = []
    tmp = pathlib.Path(tempfile.mkdtemp())
    with sync_playwright() as p:
        browser, page, errors = launch(p, viewport=(1280, 800), downloads=True)
        f = page.evaluate
        data = f(MAKE, [640, 400, False]).split(',', 1)[1]
        (tmp / 'wide.png').write_bytes(base64.b64decode(data))
        page.click('#modePoster'); page.wait_for_timeout(300)
        page.set_input_files('#pFile', [str(tmp / 'wide.png')]); page.wait_for_timeout(500)
        # alpha of the layer's own picture at a point given in 0-1 of its box
        alpha = """([u, v]) => { const P = window.fxlab.Poster, L = P.P.doc.layers[0], r = P.processed(L), c = document.createElement('canvas'); c.width = c.height = 1;
          const w = (r.canvas.width || r.canvas.naturalWidth) - r.pad * 2, h = (r.canvas.height || r.canvas.naturalHeight) - r.pad * 2;
          const x = c.getContext('2d'); x.drawImage(r.canvas, r.pad + u * w, r.pad + v * h, 1, 1, 0, 0, 1, 1); return x.getImageData(0, 0, 1, 1).data[3]; }"""
        # remove a colour: the red half goes
        f("() => { const L = window.fxlab.Poster.P.doc.layers[0]; L.key.on = true; L.key.color = '#d04020'; }")
        if f(alpha, [.25, .5]) != 0 or f(alpha, [.75, .5]) != 255: bad.append('colour key did not remove only the red half')
        f("() => { window.fxlab.Poster.P.doc.layers[0].key.on = false; }")
        # crop the left half: the box halves and what's left stays where it was
        x0 = f("() => window.fxlab.Poster.P.doc.layers[0].x")
        page.click('#pProps summary:has-text("Cut out")')
        page.fill('input[aria-label="Left value"]', '50'); page.locator('input[aria-label="Left value"]').dispatch_event('change')
        L = f("() => { const L = window.fxlab.Poster.P.doc.layers[0]; return { x:L.x, l:L.crop.l, sx:L.sx, w:L.image.w }; }")
        if abs(L['l'] - .5) > .001 or abs((L['x'] - x0) - L['w'] * L['sx'] / 4) > .5: bad.append(f'crop moved the picture: {L}, x0 {x0}')
        page.locator('#pStage').focus(); page.keyboard.press('Control+z')
        if f("() => window.fxlab.Poster.P.doc.layers[0].crop.l") != 0: bad.append('undo did not take the crop off')
        # erase a stroke across the middle
        f("() => { const P = window.fxlab.Poster; P.setTool('erase'); P.P.brush.size = 60; }")
        box = page.locator('#pStage').bounding_box(); v = f("() => window.fxlab.Poster.P.view")
        X = lambda x: box['x'] + v['ox'] + x * v['k']; Y = lambda y: box['y'] + v['oy'] + y * v['k']
        page.mouse.move(X(300), Y(675)); page.mouse.down(); page.mouse.move(X(780), Y(675), steps=12); page.mouse.up()
        if not f("() => !!window.fxlab.Poster.P.doc.layers[0].mask"): bad.append('erase made no mask')
        if f(alpha, [.5, .5]) > 10 or f(alpha, [.5, .05]) < 240: bad.append('erase did not cut only along the stroke')
        # torn edge with a rim, then a sticker outline grows the picture
        f("() => { const L = window.fxlab.Poster.P.doc.layers[0]; L.edge.style = 'torn'; L.edge.depth = 30; L.edge.rim = true; }")
        if f(alpha, [.002, .002]) != 0: bad.append('torn edge left the corner')
        f("() => { const L = window.fxlab.Poster.P.doc.layers[0]; L.outline.on = true; }")
        if f("() => window.fxlab.Poster.processed(window.fxlab.Poster.P.doc.layers[0]).pad") < 5: bad.append('outline added no border')
        # marks: painting with nothing suitable selected starts a marks layer
        f("() => { const P = window.fxlab.Poster; P.setTool('paint'); P.P.brush.brush = 'charcoal'; }")
        page.mouse.move(X(200), Y(200)); page.mouse.down(); page.mouse.move(X(700), Y(260), steps=10); page.mouse.up()
        if f("() => window.fxlab.Poster.P.doc.layers.filter(l => l.paint).length") != 1: bad.append('paint did not start a marks layer')
        page.keyboard.press('Escape')
        # clipping: a rectangle clipped to a small ellipse shows only inside it
        f("""() => { const P = window.fxlab.Poster, d = P.P.doc; P.addShape('ellipse'); const E = d.layers[d.layers.length - 1]; E.x = 900; E.y = 1200; E.shape.w = E.shape.h = 100;
            P.addShape('rect'); const R = d.layers[d.layers.length - 1]; R.x = 900; R.y = 1200; R.shape.w = R.shape.h = 300; R.shape.fill = '#00ff00'; R.clip = true; }""")
        px = f("""([x, y]) => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; window.fxlab.Poster.drawDoc(c.getContext('2d'), 1); return [...c.getContext('2d').getImageData(x, y, 1, 1).data]; }""", [900, 1200])
        out = f("""([x, y]) => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; window.fxlab.Poster.drawDoc(c.getContext('2d'), 1); return [...c.getContext('2d').getImageData(x, y, 1, 1).data]; }""", [1020, 1200])
        if px[:3] != [0, 255, 0] or out[1] == 255 and out[0] == 0: bad.append(f'clipping: inside {px}, outside {out}')
        n = f("() => window.fxlab.Poster.P.doc.layers.length")
        f("() => window.fxlab.Poster.mergeDown()")
        if f("() => window.fxlab.Poster.P.doc.layers.length") != n - 1: bad.append('merge down did not join two layers')
        f("() => { const P = window.fxlab.Poster; P.addText(); P.rasterise(); }")
        if f("() => window.fxlab.Poster.P.doc.layers.at(-1).type") != 'image': bad.append('turn into image did not')
        # save and open keep the mask
        with page.expect_download() as d: page.click('#pSave')
        saved = tmp / 'c.fxposter.json'; d.value.save_as(saved)
        f("() => { window.fxlab.Poster.P.doc.layers = []; }")
        page.set_input_files('#pFileProject', str(saved)); page.wait_for_timeout(800)
        f("() => { const L = window.fxlab.Poster.P.doc.layers[0]; L.outline.on = false; L.edge.style = 'none'; }")
        if f(alpha, [.5, .5]) > 10: bad.append('the erased stroke came back after save and open')
        browser.close()
        bad += [e for e in errors if 'favicon' not in e]
    return bad


if __name__ == '__main__':
    sys.exit(report('poster', run() + collage(), 'layers, effects, export, save and open, cut-outs, edges, clipping, marks, merge'))
