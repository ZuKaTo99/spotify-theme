// =============================================================================
// Datei: ThemeStudio.tsx
// Zweck: Hintergrund und Bedienelemente unabhängig färben, ohne die häufigsten
// Farbwelten hinter einer langen Einstellungsseite zu verstecken.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { loadBackgroundPalette, loadPalette, PALETTES, paletteColor, saveBackgroundPalette,
  savePalette, normalizePalette,
  type PaletteId, type PaletteSelection } from "../../../shared/appearance";
const ReactRuntime = Spicetify.React as typeof import("react");
const FEATURED: PaletteId[] = ["violet", "sky", "emerald", "rose", "coral", "gold"];

interface ColorSectionProps {
  title: string;
  selection: PaletteSelection;
  onChoose: (next: PaletteSelection) => void;
  t: Translator;
}

function ColorSection({ title, selection, onChoose, t }: ColorSectionProps): ReactElement {
  const [draft, setDraft] = ReactRuntime.useState(() => paletteColor(selection));
  const [error, setError] = ReactRuntime.useState("");
  function choose(next: PaletteSelection): void {
    onChoose(next);
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
  const color = paletteColor(selection);
  const choice = (id: PaletteId) => <button type="button" className={selection === id ? "is-selected" : ""} key={id}
    onClick={() => choose(id)} aria-label={`${title}: ${PALETTES[id].name} ${PALETTES[id].accent}`}
    aria-pressed={selection === id} title={`${PALETTES[id].name} · ${PALETTES[id].accent}`}>
    <span style={{ background: PALETTES[id].accent }} />{PALETTES[id].name}
  </button>;
  return <section className="zukato-theme-studio__section" aria-label={title}>
    <div className="zukato-theme-studio__heading">
      <h3>{title}</h3>
      <span><i style={{ background: color }} />{selection.startsWith("#") ? color : PALETTES[selection as PaletteId].name}</span>
    </div>
    <div className="zukato-palette zukato-palette--featured">{FEATURED.map(choice)}</div>
    <details className="zukato-theme-studio__more">
      <summary>{t("appearance.more")}</summary>
      <div className="zukato-palette zukato-palette--more">
        {(Object.keys(PALETTES) as PaletteId[]).filter((id) => !FEATURED.includes(id)).map(choice)}
      </div>
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
    </details>
  </section>;
}

export function ThemeStudio({ t }: { t: Translator }): ReactElement {
  const [background, setBackground] = ReactRuntime.useState<PaletteSelection>(loadBackgroundPalette);
  const [controls, setControls] = ReactRuntime.useState<PaletteSelection>(loadPalette);
  function chooseBackground(next: PaletteSelection): void {
    saveBackgroundPalette(next);
    setBackground(next);
  }
  function chooseControls(next: PaletteSelection): void {
    savePalette(next);
    setControls(next);
  }
  return <div className="zukato-theme-studio">
    <ColorSection title={t("appearance.background")} selection={background} onChoose={chooseBackground} t={t} />
    <ColorSection title={t("appearance.controls")} selection={controls} onChoose={chooseControls} t={t} />
  </div>;
}
