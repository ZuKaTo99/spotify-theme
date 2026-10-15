// =============================================================================
// Datei: src/custom-app/modules/visualizer/VisualizerPresets.tsx
// Zweck: Drei sofort nutzbare Szenen und bis zu acht eigene Style-Presets.
// Wo ändern? Preset-UI hier; Speicherlogik und Grenzen in visualizer-config.ts.
// Hinweis: Ein Preset ändert NIE Video- oder LRC-Dateien / Zuordnungen.
// =============================================================================
import type { ReactElement } from "react";
import type { Translator } from "../../../shared/i18n";
import {
  BUILTIN_VISUALIZER_PRESETS, deleteVisualizerPreset,
  loadVisualizerPresets, saveVisualizerPreset,
  VISUALIZER_PRESETS_CHANGED_EVENT, type VisualizerConfig,
} from "../../../shared/visualizer-config";

const ReactRuntime = Spicetify.React as typeof import("react");

/** Presets werden live beim Speichern aktualisiert; Felder bleiben editierbar. */
export function VisualizerPresets({ t, config, onApply, onError }: {
  t: Translator;
  config: VisualizerConfig;
  onApply: (value: VisualizerConfig) => void;
  onError: (message: string) => void;
}): ReactElement {
  const [presets, setPresets] = ReactRuntime.useState(loadVisualizerPresets);
  const [selected, setSelected] = ReactRuntime.useState("cinema");
  const [name, setName] = ReactRuntime.useState("");

  ReactRuntime.useEffect(() => {
    const refresh = (): void => setPresets(loadVisualizerPresets());
    window.addEventListener(VISUALIZER_PRESETS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(VISUALIZER_PRESETS_CHANGED_EVENT, refresh);
  }, []);

  /** Bestehende Konfiguration bleibt unverändert, bis Anwenden geklickt wird. */
  function apply(): void {
    const builtin = BUILTIN_VISUALIZER_PRESETS.find((preset) => preset.id === selected);
    const own = presets.find((preset) => preset.id === selected);
    const picked = builtin?.config ?? own?.config;
    if (!picked) return;
    try {
      onApply(picked);
    } catch (cause) { onError(String(cause)); }
  }

  /** Erst bei Klick normalisieren und speichern, beim Tippen Leerzeichen erhalten. */
  function save(): void {
    try {
      const saved = saveVisualizerPreset(name, config);
      setSelected(saved[saved.length - 1].id);
      setName("");
    } catch (cause) { onError(cause instanceof Error ? cause.message : String(cause)); }
  }

  /** Nur selbst erstellte Presets können gelöscht werden. */
  function remove(): void {
    if (!presets.some((preset) => preset.id === selected)) return;
    try {
      deleteVisualizerPreset(selected);
      setSelected("cinema");
    } catch (cause) { onError(String(cause)); }
  }

  return <section className="zukato-viz__controls zukato-viz__presets">
    <h3>{t("viz.presetsHeading")}</h3>
    <p>{t("viz.presetsHelp")}</p>
    <label>{t("viz.presetSelect")}
      <select value={selected} onChange={(event) => setSelected(event.currentTarget.value)}>
        <option value="cinema">{t("viz.presetCinema")}</option>
        <option value="karaoke">{t("viz.presetKaraoke")}</option>
        <option value="concert">{t("viz.presetConcert")}</option>
        {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
      </select>
    </label>
    <div className="zukato-viz__library-actions">
      <button type="button" onClick={apply}>{t("viz.presetApply")}</button>
      <button type="button" disabled={!presets.some((preset) => preset.id === selected)} onClick={remove}>{t("viz.presetDelete")}</button>
    </div>
    <label>{t("viz.presetName")}
      <input type="text" value={name} maxLength={40} placeholder={t("viz.presetPlaceholder")}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === "Enter") save(); }} />
    </label>
    <button type="button" disabled={!name.trim() || presets.length >= 8} onClick={save}>{t("viz.presetSave")}</button>
    <span className="zukato-viz__hint">{t("viz.presetCount", { count: String(presets.length) })}</span>
  </section>;
}
