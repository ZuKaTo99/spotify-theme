// =============================================================================
// Datei: src/custom-app/hooks/useToolkitData.ts
// Zweck: Live-Hook für gemeinsame, lokal gespeicherte Moduldaten.
// =============================================================================
import { loadLibrary, subscribeLibrary, type ToolkitLibrary } from "../../shared/library";

// Die React-Instanz kommt ausschließlich aus Spotify (kein zweiter React-Bundle).
const ReactRuntime = Spicetify.React as typeof import("react");

/** Hält Hörverlauf, Notizen und Favoriten ohne Polling synchron. */
export function useToolkitData(): ToolkitLibrary {
  const [data, setData] = ReactRuntime.useState<ToolkitLibrary>(loadLibrary);
  ReactRuntime.useEffect(() => subscribeLibrary(setData), []);
  return data;
}
