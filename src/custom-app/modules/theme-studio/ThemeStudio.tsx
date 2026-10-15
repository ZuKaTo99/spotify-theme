// =============================================================================
// Datei: src/custom-app/modules/theme-studio/ThemeStudio.tsx
// Zweck: Akzentfarbe auswählen und gerätespezifisch sichern.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import { loadPalette, PALETTES, savePalette, type PaletteId } from "../../../shared/appearance";
const ReactRuntime = Spicetify.React as typeof import("react");

export function ThemeStudio({ t }: { t: Translator }): ReactElement {
  const [selected, setSelected] = ReactRuntime.useState<PaletteId>(loadPalette);
  return <section className="zukato-panel">
    <p>{t("appearance.intro")}</p>
    <div className="zukato-palette">
      {(Object.entries(PALETTES) as Array<[PaletteId, { name: string; accent: string }]>).map(([id, palette]) =>
        <button type="button" className={selected === id ? "is-selected" : ""} key={id} onClick={() => {
          savePalette(id);
          setSelected(id);
        }} aria-pressed={selected === id}>
          <span style={{ background: palette.accent }} />{palette.name}
        </button>)}
    </div>
    <p>{t("appearance.current")} <strong>{PALETTES[selected].name}</strong></p>
  </section>;
}
