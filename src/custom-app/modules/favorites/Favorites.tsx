// =============================================================================
// Datei: src/custom-app/modules/favorites/Favorites.tsx
// Zweck: Gerüst für das spätere Favoriten-Modul.
// =============================================================================
import type {
  ReactElement,
} from "react";

import type {
  Translator,
} from "../../../shared/i18n";

import {
  ModulePlaceholder,
} from "../../components/ModulePlaceholder";

// -----------------------------------------------------------------------------
// Datenvertrag `FavoritesProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface FavoritesProps {
  t: Translator;
}

// -----------------------------------------------------------------------------
// Funktion `Favorites` kapselt einen eigenständigen Arbeitsschritt dieses Moduls.
// -----------------------------------------------------------------------------
export function Favorites({
  t,
}: FavoritesProps): ReactElement {
  return (
    <ModulePlaceholder
      t={t}
    />
  );
}