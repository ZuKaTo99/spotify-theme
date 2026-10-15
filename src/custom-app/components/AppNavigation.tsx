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
import type { Translator } from "../../shared/i18n";
import { workspaceGroup, type WorkspaceGroup } from "../../shared/workspace-navigation";

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
  t: Translator;
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
  t,
  onSelect,
}: AppNavigationProps): ReactElement {
  const groups: WorkspaceGroup[] = ["start", "library", "creative", "system"];
  return (
    <nav
      className="spotify-toolkit-navigation"
      aria-label={ariaLabel}
    >
      {groups.map((group) => {
        const entries = items.filter((item) => workspaceGroup(item.id) === group);
        return entries.length > 0 ? <div className="spotify-toolkit-navigation__group" key={group}>
          <span className="spotify-toolkit-navigation__group-label">{t(`navigation.${group}`)}</span>
          <div className="spotify-toolkit-navigation__buttons">{entries.map((item) => {
            const isActive = item.id === activeFeatureId;
            return <button key={item.id} type="button"
              className={isActive
                ? "spotify-toolkit-navigation__item spotify-toolkit-navigation__item--active"
                : "spotify-toolkit-navigation__item"}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item.id)}>{item.title}</button>;
          })}</div>
        </div> : null;
      })}
    </nav>
  );
}