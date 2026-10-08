// =============================================================================
// Datei: src/custom-app/components/AppNavigation.tsx
// Zweck: Navigation der Custom App: rendert sichtbare Workspace-Module als auswählbare Schaltflächen.
// =============================================================================
import type {
  ReactElement,
} from "react";

import type {
  FeatureId,
} from "../../shared/features";

// -----------------------------------------------------------------------------
// Datenvertrag `AppNavigationItem` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
export interface AppNavigationItem {
  id: FeatureId;
  title: string;
}

// -----------------------------------------------------------------------------
// Datenvertrag `AppNavigationProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface AppNavigationProps {
  items: readonly AppNavigationItem[];
  activeFeatureId: FeatureId;
  ariaLabel: string;
  onSelect: (
    featureId: FeatureId,
  ) => void;
}

// -----------------------------------------------------------------------------
// Rendert die Modulnavigation und markiert den aktuell aktiven Eintrag.
// -----------------------------------------------------------------------------
export function AppNavigation({
  items,
  activeFeatureId,
  ariaLabel,
  onSelect,
}: AppNavigationProps): ReactElement {
  return (
    <nav
      className="spotify-toolkit-navigation"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive =
          item.id === activeFeatureId;

        return (
          <button
            key={item.id}
            type="button"
            className={
              isActive
                ? "spotify-toolkit-navigation__item spotify-toolkit-navigation__item--active"
                : "spotify-toolkit-navigation__item"
            }
            aria-current={
              isActive
                ? "page"
                : undefined
            }
            onClick={() =>
              onSelect(item.id)
            }
          >
            {item.title}
          </button>
        );
      })}
    </nav>
  );
}