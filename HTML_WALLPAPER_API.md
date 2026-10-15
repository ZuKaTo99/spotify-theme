# ZuKaTo v1.7 – HTML-Wallpaper und Song-Signale

> Dieses Dokument beschreibt die **Schnittstelle für deine selbst erstellten** HTML-Wallpapers. ZuKaTo bringt keine fertigen Wallpaper, Musikvideos oder Songtexte mit.

## Welche Dateien importiert werden

Du kannst in **ZuKaTo → Einstellungen → HTML-Wallpapers** einen Hauptordner auswählen, in dessen Unterordnern je ein `index.html` und dessen CSS-/JavaScript-/Bilddateien liegen. ZuKaTo kopiert und verpackt die Dateien beim Import. Die Originale verbleiben unberührt auf deinem Rechner; eine automatische Überwachung oder Synchronisation des Ordners findet nicht statt.

Die Liste wird natürlich sortiert (`01`, `02`, `10`). Ein neues Wallpaper wird **nur bei einem neuen Songdurchlauf** gewählt – auch bei Skip oder Repeat. Die Reihenfolge läuft zyklisch. Eine neu importierte Liste beginnt beim nächsten Songwechsel mit ihrem ersten Eintrag. Beim Wechsel auf andere Workspace-Seiten oder beim Spotify-Neustart wird der zuletzt beobachtete Songzähler lokal gespeichert.

## JavaScript-Ereignis `zukato:player`

In einem eigenen HTML-Projekt kannst du den Playerstatus empfangen, um eine CSS-/Canvas-Animation an Titelposition, Pause und Resume auszurichten:

```js
// Diese Zeilen gehören in DEIN eigenes JavaScript innerhalb des Wallpapers.
// Sie sind ein Beispiel für die Schnittstelle und keine vorinstallierte Szene.
window.addEventListener("zukato:player", (event) => {
  const { playing, run, positionMs, durationMs } = event.detail;
  // playing    = true/false (Spotify spielt oder ist pausiert)
  // run        = laufende Nummer des aktuell beobachteten Songdurchlaufs
  // positionMs = Spotify-Songposition in Millisekunden
  // durationMs = Songdauer in Millisekunden
  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  // Hier kannst du deine eigenen Elemente, Shader oder Effekte aktualisieren.
  document.documentElement.style.setProperty("--song-progress", String(progress));
});
```

ZuKaTo pausiert CSS-Animationen und stumm geschaltete HTML-Videos automatisch, solange Spotify pausiert. Freie JavaScript-Animationsloops müssen deinen eigenen `playing`-Wert beachten. Das Event wird etwa viermal pro Sekunde übermittelt, **keine** echte Audiofrequenz-, Beat- oder Lautstärkeinformation. Das Interface beinhaltet absichtlich keine Zugangsdaten oder privaten Spotify-Informationen.

## Sandbox / Kompatibilität

- Das Web-Wallpaper läuft in einem isolierten `iframe` ohne `allow-same-origin`, mit `default-src 'none'` und deaktiviertem `connect-src`. Daher sind API-Requests, `fetch` externer Assets und Zugriffe auf Spotify-Interna blockiert.
- Lokale CSS-/JS-/Bilder/Fonts und Videos werden beim Import eingebettet. Auch verschachtelte Pfade wie `css/main.css` mit `url(../images/bg.png)` werden berücksichtigt.
- `project.json` wird akzeptiert, **aber keine proprietären Wallpaper-Engine-APIs oder nativen `.pkg`-Szenen emuliert**. Web-Wallpapers mit externen/Runtime-Abhängigkeiten müssen vorher angepasst werden.
- Ein HTML-Projekt: maximal 64 Dateien und 12 MiB; Bibliothek insgesamt 128 Szenen/512 MiB. Ein importierter Ordner ist eine lokale Kopie und kein dauerhaft angebundener Desktop-Ordner.
- Die **Vorschau** läuft ebenfalls in einer Sandbox. Sie sendet einen neutralen Startstatus; Songposition wird nur auf der eigentlichen Bühne übermittelt.

## Originalclips und Lyrics

**Wallpapers AN:** deine HTML- oder Videowallpapers. **Wallpapers AUS:** nur die von dir hinterlegten direkten HTTPS-Videolinks. Eine automatische Suche nach Spotify Canvas/Musikvideo-Ausschnitten ist noch nicht enthalten. Für Musikvideos dürfen nur Quellen mit geeigneten Nutzungsrechten verwendet werden.

Ein `.lrc`-Text wird unabhängig vom Hintergrundvideo über die Bühne gelegt. Der LRC-Editor und das Lyrics-Design sind bereits vorhanden; die automatische Einbindung offizieller synchronisierter Songtexte benötigt noch eine rechtlich und technisch passende Quelle.

## Laufzeit und Fehleranalyse

Der globale Zähler wird von der ZuKaTo-Extension verfolgt; wenn nur die Custom App installiert ist, beobachtet sie Songwechsel als Fallback, solange sie geöffnet ist. Eine neue Installation ohne gespeicherten Zustand startet bei Index 0. Bei einem neuen Import/Neusortieren wird die betreffende Playlist ab dem **nächsten** Songwechsel auf ihren ersten Eintrag ausgerichtet. Wiederholte `songchange`-Events mit derselben Wiedergabe werden soweit möglich dedupliziert. Bei API-Abweichungen, fehlenden Playback-IDs oder wiederholten identischen Songs sollte die Reihenfolge im echten Spotify-Client überprüft werden.

Die Verwaltungsoberfläche meldet fehlende Dateien, die z. B. nach einem Profilwechsel entstehen: Das JSON-Backup speichert Zuordnungs-IDs, aber nicht die HTML-/Videoblobs. Bewahre deine Quellordner bitte separat auf und importiere sie auf einem neuen Rechner erneut.
