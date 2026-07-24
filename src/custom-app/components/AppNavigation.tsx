import type {
  ReactElement,
} from "react";

import type {
  FeatureId,
} from "../../shared/features";

export interface AppNavigationItem {
  id: FeatureId;
  title: string;
}

interface AppNavigationProps {
  items: readonly AppNavigationItem[];
  activeFeatureId: FeatureId;
  ariaLabel: string;
  onSelect: (
    featureId: FeatureId,
  ) => void;
}

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