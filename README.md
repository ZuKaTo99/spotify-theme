# ZuKaTo Spicetify / Spotify Toolkit

Dieses Repository enthält Custom App, Spicetify-Extension, gemeinsame Logik sowie Build- und Installationswerkzeuge.

## Kommentar-Konvention

Alle selbst gepflegten TypeScript-, TSX-, MJS-, SCSS- und INI-Dateien enthalten Datei- und Abschnittskommentare. Die Kommentare sollen beim Navigieren in VS Code sofort zeigen, **welcher Bereich wofür zuständig ist und warum er existiert**.

Strikte JSON-Dateien wie `package.json`, `package-lock.json` und `src/custom-app/manifest.json` erhalten bewusst keine Kommentare, weil Kommentare dort das JSON ungültig machen können. Generierte Dateien in `dist/`, installierte Abhängigkeiten in `node_modules/` und Git-Metadaten werden nicht manuell gepflegt.

## Wichtige Befehle

```powershell
npm run check
npm run build
npm run install:spicetify
```
