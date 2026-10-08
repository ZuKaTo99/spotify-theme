// =============================================================================
// Datei: src/custom-app/index.tsx
// Zweck: Einstiegspunkt der Spicetify Custom App und Export der erwarteten render-Funktion.
// =============================================================================
import type { ReactElement } from "react";

import { App } from "./App";

/**
 * Einstiegspunkt, den Spicetify beim Öffnen
 * der eigenen Sidebar-Seite aufruft.
 */
export function render(): ReactElement {
  return <App />;
}