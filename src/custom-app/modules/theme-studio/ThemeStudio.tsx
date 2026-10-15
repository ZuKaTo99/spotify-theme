// =============================================================================
// Datei: ThemeStudio.tsx
// Zweck: 24 Farbvorschläge plus beliebige eigene HEX-Farbe; Live-Vorschau.
// Alle Farben wirken im ZuKaTo-Workspace und werden im Backup mitgesichert.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { loadPalette, PALETTES, paletteColor, savePalette, normalizePalette,
  type PaletteId, type PaletteSelection } from "../../../shared/appearance";
const ReactRuntime = Spicetify.React as typeof import("react");

export function ThemeStudio({ t }: { t: Translator }): ReactElement {
  const [selected, setSelected] = ReactRuntime.useState<PaletteSelection>(loadPalette);
  const [draft, setDraft] = ReactRuntime.useState(paletteColor(loadPalette()));
  const [error, setError] = ReactRuntime.useState("");
  function choose(next: PaletteSelection): void {
    savePalette(next);
    setSelected(next);
    setDraft(paletteColor(next));
    setError("");
  }
  function saveHex(): void {
    if (!/^#[a-fA-F0-9]{6}$/.test(draft.trim())) {
      setError(t("appearance.invalid"));
      return;
    }
    choose(normalizePalette(draft.trim()));
  }
  const color = paletteColor(selected);
  return <section className="zukato-panel zukato-theme-studio">
    <p>{t("appearance.intro")}</p>
    <h3>{t("appearance.presets")}</h3>
    <div className="zukato-palette">
      {(Object.entries(PALETTES) as Array<[PaletteId, { name: string; accent: string }]>).map(([id, palette]) =>
        <button type="button" className={selected === id ? "is-selected" : ""} key={id}
          onClick={() => choose(id)} aria-label={`${palette.name} ${palette.accent}`}
          aria-pressed={selected === id} title={`${palette.name} · ${palette.accent}`}>
          <span style={{ background: palette.accent }} />{palette.name}
        </button>)}
    </div>
    <h3>{t("appearance.custom")}</h3>
    <div className="zukato-custom-color">
      <label>{t("appearance.picker")}
        <input type="color" value={/^#[\da-fA-F]{6}$/.test(draft) ? draft : color}
          onChange={(event) => setDraft(event.currentTarget.value)} />
      </label>
      <label>{t("appearance.hex")}
        <input type="text" maxLength={7} placeholder="#1ed760" value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)} />
      </label>
      <button type="button" onClick={saveHex}>{t("appearance.apply")}</button>
    </div>
    {error && <p role="alert" className="zukato-error">{error}</p>}
    {/* Die Vorschau entspricht den tatsächlichen Workspace-Elementen statt
        nur einem farbigen Rahmen. Sie ist absichtlich rein dekorativ. */}
    <div className="zukato-theme-preview zukato-theme-preview--live" style={{ borderColor: color }}>
      <div className="zukato-theme-preview__caption">
        <span className="zukato-theme-preview__dot" style={{ background: color }} />
        <span>{t("appearance.current")} <strong>{selected.startsWith("#") ? color : PALETTES[selected as PaletteId].name}</strong> ({color})</span>
      </div>
      <div className="zukato-theme-preview__example" aria-hidden="true">
        <div className="zukato-theme-preview__example-heading">
          <span className="zukato-theme-preview__example-disc" style={{ background: color }}>♫</span>
          <div><strong>ZuKaTo</strong><small>Music Workspace</small></div>
        </div>
        <div className="zukato-theme-preview__example-bars">
          {[46, 75, 59, 92, 65, 38, 71, 53, 88, 42, 61, 77].map((value, index) =>
            <span key={index} style={{ background: color, height: `${value}%` }} />)}
        </div>
        <div className="zukato-theme-preview__example-button" style={{ background: color, color: "#111" }}>♫</div>
      </div>
    </div>
  </section>;
}
