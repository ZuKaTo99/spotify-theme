#!/usr/bin/env python3
"""Browser-Smoke für reale isolierte HTML-Wallpapers (optional).

Benötigt `pip install playwright` und einen installierten Chromium-Browser.
Baut KEINE Spotify-Daten nach und prüft NICHT DRM-/Systemaudio, sondern:
- Rendering/Audio-Message-Bridge der beiden Nebula-Projekte,
- project-v2 iframe Bootstrap und Speicherung über local-/sessionStorage,
- Wiederherstellen der Nachrichtenlistener nach document.open().

Aufruf aus dem Spotify-Projekt: python tools/test-wallpaper-browser.py
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Playwright fehlt. Optional installieren: python -m pip install playwright")

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
BROWSER = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chrome")


def bootstrap_document():
    """Projekt-Bootstrap aus dem TS-Quellcode, mit seiner echten CSP, auswerten."""
    js = r"""
const fs=require('fs');
const src=fs.readFileSync('src/custom-app/modules/visualizer/wallpaper-project.ts','utf8');
const web=fs.readFileSync('src/custom-app/modules/visualizer/web-wallpaper.ts','utf8');
const csp=web.match(/WEB_WALLPAPER_CSP = "([^"]+)"/)[1]
  .replace('font-src data:', 'font-src data: blob:')
  .replace("connect-src 'none'", 'connect-src blob: data:')
  .replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' blob:");
const template=src.match(/export const PROJECT_BOOTSTRAP = `([\s\S]*?)`;/)[1];
process.stdout.write(Function('PROJECT_CSP','return `'+template+'`')(csp));
"""
    return subprocess.check_output(["node", "-e", js], cwd=ROOT, text=True)


def exercise_storage(browser):
    """Gegentest: nach document.open wird StorageSync weiterhin verarbeitet."""
    page = browser.new_page(viewport={"width": 1000, "height": 700})
    errors = []
    page.on("pageerror", lambda exception: errors.append(str(exception)))
    page.set_content('<iframe sandbox="allow-scripts"></iframe>')
    page.evaluate("""() => {window.__messages=[];
        window.addEventListener('message', e=>window.__messages.push(e.data));} """)
    page.locator("iframe").evaluate("(el,src)=>el.srcdoc=src", bootstrap_document())
    page.wait_for_function("window.__messages.some(m=>m.zukatoProjectReady)")
    markup = """<!doctype html><html><body><script>
      window.__changes=0;
      window.addEventListener('storage',()=>window.__changes++);
      window.__initial=localStorage.getItem('color');
      </script></body></html>"""
    page.locator("iframe").evaluate("""(el,html)=>el.contentWindow.postMessage({
      zukatoProjectInit:true,html:html,entry:'index.html',assets:[],modules:[],
      storageToken:'test-token',storage:{color:'blue'},sessionStorage:{view:'home'}},'*')""", markup)
    page.wait_for_function("window.__messages.some(m=>m.zukatoProjectMounted)")
    inner = page.frame_locator("iframe").locator("body")
    assert inner.evaluate("() => window.__initial") == "blue"
    page.locator("iframe").evaluate("""el=>el.contentWindow.postMessage({
      zukatoProjectStorageSync:true,storageToken:'test-token',
      storage:{color:'violet'},sessionStorage:{view:'settings'}},'*')""")
    page.wait_for_function("""() => {
      const f=document.querySelector('iframe');
      return f.contentWindow != null && window.__messages.some(m=>m.zukatoProjectMounted)
    }""")
    page.wait_for_timeout(200)
    values = inner.evaluate("""() => ({color:localStorage.getItem('color'),
      view:sessionStorage.getItem('view'),changes:window.__changes})""")
    assert values == {"color": "violet", "view": "settings", "changes": 2}, values
    inner.evaluate("() => localStorage.setItem('color','cyan')")
    page.wait_for_function("window.__messages.some(m=>m.zukatoProjectStorage && m.value==='cyan')")
    assert not errors, errors
    page.close()
    return values


def exercise_nebula(browser, project_name):
    """Echte Wallpaper-JS im sandbox-iframe statt nur gemocktes Node-vm."""
    project = WORKSPACE / project_name
    markup = (project / "index.html").read_text(encoding="utf-8")
    engine = (project / "js" / "engine.js").read_text(encoding="utf-8")
    # CSS nicht über Dateipfade nachladen; der Browser-Smoke braucht kein Netzwerk.
    import re
    css = next((project / "css").glob("*.css")).read_text(encoding="utf-8")
    markup = re.sub(r'<link[^>]+href="[^"]+\.css"[^>]*>', lambda _: "<style>" + css + "</style>", markup)
    markup = markup.replace('<script src="js/engine.js"></script>', "<script>" + engine + "</script>")
    page = browser.new_page(viewport={"width": 1200, "height": 720})
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.set_content('<iframe sandbox="allow-scripts"></iframe>')
    page.locator("iframe").evaluate("(el,html)=>el.srcdoc=html", markup)
    frame = page.frame_locator("iframe")
    frame.locator("#audioStatus").wait_for(state="attached")
    page.evaluate("""() => {const f=document.querySelector('iframe').contentWindow;
      f.postMessage({zukatoWallpaper:true,playing:true,title:'Smoke',artist:'Test'},'*');
      f.postMessage({zukatoWallpaperAudio:true,spectrum:Array(64).fill(.7)},'*');}""")
    page.wait_for_timeout(1000)
    assert frame.locator("#trackTitle").inner_text() == "Smoke"
    assert "Freigegebenes Audio" in frame.locator("#audioStatus").inner_text()
    page.evaluate("""() => document.querySelector('iframe').contentWindow.postMessage({
      zukatoWallpaper:true,playing:false,title:'Smoke',artist:'Test'},'*')""")
    page.wait_for_timeout(100)
    assert frame.locator("body").get_attribute("data-playing") == "false"
    page.evaluate("""() => document.querySelector('iframe').contentWindow.postMessage({
      zukatoWallpaper:true,playing:true,title:'Smoke',artist:'Test'},'*')""")
    page.wait_for_timeout(100)
    assert frame.locator("body").get_attribute("data-playing") == "true"
    assert not errors, errors
    page.close()
    return "OK"


if __name__ == "__main__":
    with sync_playwright() as playwright:
        launch = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if BROWSER:
            launch["executable_path"] = BROWSER
        browser = playwright.chromium.launch(**launch)
        try:
            print("sandbox-storage:", json.dumps(exercise_storage(browser), ensure_ascii=False))
            for title in ("Birkan Nebula Engine", "ZuKaTo Nebula Engine"):
                print(title + ":", exercise_nebula(browser, title))
        finally:
            browser.close()
    print("3/3 Browser-Smokes bestanden")
