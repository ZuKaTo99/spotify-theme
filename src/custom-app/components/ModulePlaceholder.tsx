// =============================================================================
// Datei: src/custom-app/components/ModulePlaceholder.tsx
// Zweck: Wiederverwendbarer Platzhalter für noch nicht implementierte Workspace-Module.
// =============================================================================
import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../shared/i18n";

// -----------------------------------------------------------------------------
// Datenvertrag `ModulePlaceholderProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface ModulePlaceholderProps {
  t: Translator;
}

// -----------------------------------------------------------------------------
// Zeigt einen lokalisierten Hinweis für noch nicht implementierte Module.
// -----------------------------------------------------------------------------
export function ModulePlaceholder({
  t,
}: ModulePlaceholderProps): ReactElement {
  return (
    <p>
      {t("module.underDevelopment")}
    </p>
  );
}