import type { ReactElement } from "react";

import { App } from "./App";

/**
 * Einstiegspunkt, den Spicetify beim Öffnen
 * der eigenen Sidebar-Seite aufruft.
 */
export function render(): ReactElement {
  return <App />;
}