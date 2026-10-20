#!/usr/bin/env python3
"""Optionaler Chromium-Smoke für den echten Mini-Player-DOM (kein Spotify-Login)."""
import os
import shutil
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BROWSER = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chrome')


def source():
    """Die echten TypeScript-Quelldateien nur von Import-/Typ-Syntax befreien."""
    script = r'''
const fs = require('node:fs');
const {stripTypeScriptTypes} = require('node:module');
const files = [
  'src/extension/modules/mini-player/mini-player-position.ts',
  'src/extension/modules/mini-player/MiniPlayerModule.ts',
];
for (const file of files) {
  const source = stripTypeScriptTypes(fs.readFileSync(file, 'utf8'), {mode:'strip'})
    .replace(/^import\s+[^;]+;\s*$/gm,'')
    .replace(/^export\s+/gm,'');
  process.stdout.write(source + '\n');
}
process.stdout.write('window.__miniPlayerModule = miniPlayerModule;\n');
'''
    return subprocess.check_output(['node', '-e', script], cwd=ROOT, text=True)


def smoke():
    with sync_playwright() as p:
        opts = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if BROWSER:
            opts['executable_path'] = BROWSER
        browser = p.chromium.launch(**opts)
        try:
            page = browser.new_page(viewport={'width': 900, 'height': 650})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.set_content('<body></body>')
            page.evaluate('''() => {
              window.currentTrack = () => ({title:'Beispielsong',artist:'ZuKaTo'});
              window.__listeners = new Map();
              window.Spicetify = {
                Player: {
                  isPlaying: () => true,
                  back(){}, next(){}, togglePlay(){},
                  addEventListener(name,cb){window.__listeners.set(name,cb)},
                  removeEventListener(name,cb){if(window.__listeners.get(name)===cb)window.__listeners.delete(name)}
                },
                Menu: {Item: class {
                  constructor(name,visible,callback){this.callback=callback; this.state=visible; window.__menu=this}
                  register(){this.registered=true}
                  deregister(){this.registered=false}
                  setState(next){this.state=next}
                }}
              };
            }''')
            page.add_script_tag(content=source())
            page.evaluate('() => window.__miniPlayerModule.start()')
            page.evaluate('() => window.__menu.callback()')
            root = page.locator('#zukato-mini-player')
            assert root.count() == 1
            assert 'Beispielsong' in root.inner_text()
            assert root.locator('svg').count() == 4

            # Tatsächliches Pointer-Capture und Drag über den rechten Rand.
            title = root.locator('div').first
            rect = title.bounding_box()
            start_x, start_y = rect['x'] + 20, rect['y'] + 10
            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(1700, 1200, steps=4)
            page.mouse.up()
            bounds = root.bounding_box()
            assert bounds['x'] + bounds['width'] <= 900, bounds
            assert bounds['y'] + bounds['height'] <= 650, bounds

            # Resize begrenzt Position noch einmal gegen die kleinere Größe.
            page.set_viewport_size({'width': 360, 'height': 210})
            # Chromium liefert set_viewport_size gelegentlich zurück, bevor
            # das asynchrone resize-Event die Extension erreicht. Warten auf
            # den *tatsächlichen* DOM-Zustand vermeidet einen Test-Race.
            page.wait_for_function("""() => {
              const el = document.querySelector('#zukato-mini-player');
              if (!el) return false;
              const box = el.getBoundingClientRect();
              return box.left >= 0 && box.top >= 0 &&
                box.right <= window.innerWidth && box.bottom <= window.innerHeight;
            }""", timeout=3000)
            bounds = root.bounding_box()
            assert bounds['x'] + bounds['width'] <= 360, bounds
            assert bounds['y'] + bounds['height'] <= 210, bounds

            # Extern entferntes Panel darf beim erneuten Öffnen nicht hängen bleiben.
            page.evaluate("() => {document.querySelector('#zukato-mini-player').remove(); window.__menu.callback(); window.__menu.callback()}")
            assert root.count() == 1
            page.evaluate('() => window.__miniPlayerModule.stop()')
            assert root.count() == 0
            assert page.evaluate('window.__listeners.size') == 0
            assert not errors, errors
            print('Mini-Player Chromium: Drag/Resize/Reopen/Stop OK')
        finally:
            browser.close()


if __name__ == '__main__':
    smoke()
