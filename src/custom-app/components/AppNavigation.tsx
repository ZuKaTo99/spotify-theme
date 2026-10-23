// =============================================================================
// Datei: src/custom-app/components/AppNavigation.tsx
// Zweck: Gruppen-Navigation, Modulsuche und gespeicherte Schnellzugriffe.
// Wo ändern? Such- und Pin-Regeln: src/shared/workspace-navigation.ts;
// sichtbare Beschriftungen: src/shared/i18n.ts; Layout: src/custom-app/app.scss.
// =============================================================================
import type { ReactElement } from "react";
import type { FeatureId } from "../../shared/features";
import type { Translator } from "../../shared/i18n";
import {
  filterWorkspaceNavigation,
  readWorkspacePins,
  rememberWorkspacePins,
  toggleWorkspacePin,
  WORKSPACE_PIN_LIMIT,
  workspaceGroup,
  type WorkspaceGroup,
} from "../../shared/workspace-navigation";

export interface AppNavigationItem {
  id: FeatureId;
  title: string;
}

interface AppNavigationProps {
  items: readonly AppNavigationItem[];
  activeFeatureId: FeatureId;
  ariaLabel: string;
  t: Translator;
  onSelect: (featureId: FeatureId) => void;
}

const ReactRuntime = Spicetify.React as typeof import("react");
const GROUPS: readonly WorkspaceGroup[] = ["start", "library", "creative", "system"];

/** Die angehefteten Module sind eine zweite Navigation, keine zweite Modulinstanz. */
export function AppNavigation({
  items,
  activeFeatureId,
  ariaLabel,
  t,
  onSelect,
}: AppNavigationProps): ReactElement {
  const [search, setSearch] = ReactRuntime.useState("");
  const [expanded, setExpanded] = ReactRuntime.useState(true);
  const [pins, setPins] = ReactRuntime.useState<FeatureId[]>(readWorkspacePins);
  // Ref verhindert verlorene Änderungen bei zwei sehr schnellen Pin-Klicks.
  const pinsRef = ReactRuntime.useRef(pins);
  const visibleItems = filterWorkspaceNavigation(items, search, (group) => t(`navigation.${group}`));
  // Nie deaktivierte oder entfernte Module über einen gespeicherten Pin öffnen.
  const pinnedItems = pins
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is AppNavigationItem => item !== undefined);
  const atPinLimit = pins.length >= WORKSPACE_PIN_LIMIT;

  function togglePin(featureId: FeatureId): void {
    const next = toggleWorkspacePin(pinsRef.current, featureId);
    pinsRef.current = next;
    setPins(next);
    rememberWorkspacePins(next);
  }

  function updateSearch(value: string): void {
    setSearch(value);
    if (value.trim()) setExpanded(true);
  }

  const activeTitle = items.find((item) => item.id === activeFeatureId)?.title;

  return (
    <nav className="spotify-toolkit-navigation" aria-label={ariaLabel}>
      <div className="spotify-toolkit-navigation__toolbar">
        <div className="spotify-toolkit-navigation__heading">
          <strong>{t("navigation.heading")}</strong>
          {activeTitle && <small>{t("navigation.current", { title: activeTitle })}</small>}
        </div>
        <label className="spotify-toolkit-navigation__search">
          <span className="zukato-visually-hidden">{t("navigation.search")}</span>
          <input type="search" value={search} placeholder={t("navigation.search")}
            onChange={(event) => updateSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search) {
                event.preventDefault();
                updateSearch("");
              } else if (event.key === "Enter" && visibleItems.length === 1) {
                // Ein eindeutiger Treffer kann direkt per Tastatur geöffnet werden.
                event.preventDefault();
                onSelect(visibleItems[0].id);
              } else if (event.key === "ArrowDown" && expanded && visibleItems.length > 0) {
                // Fokus auf den ersten Treffer setzen; normale Texteingabe bleibt möglich.
                const nav = event.currentTarget.closest("nav");
                const first = nav?.querySelector<HTMLButtonElement>(
                  ".spotify-toolkit-navigation__groups .spotify-toolkit-navigation__item",
                );
                if (first) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }} />
        </label>
        <button type="button" className="spotify-toolkit-navigation__toggle"
          aria-expanded={expanded} aria-controls="zukato-workspace-navigation-groups"
          onClick={() => setExpanded((open) => !open)}>
          {expanded ? t("navigation.collapse") : t("navigation.expand")}
        </button>
      </div>

      {pinnedItems.length > 0 && (
        <div className="spotify-toolkit-navigation__pinned" aria-label={t("navigation.pinned")}>
          <span className="spotify-toolkit-navigation__group-label">{t("navigation.pinned")}</span>
          <div className="spotify-toolkit-navigation__pinned-list">
            {pinnedItems.map((item) => <button key={item.id} type="button"
              className={item.id === activeFeatureId
                ? "spotify-toolkit-navigation__item spotify-toolkit-navigation__item--active"
                : "spotify-toolkit-navigation__item"}
              aria-current={item.id === activeFeatureId ? "page" : undefined}
              onClick={() => onSelect(item.id)}>{item.title}</button>)}
          </div>
        </div>
      )}

      {expanded && <div className="spotify-toolkit-navigation__groups" id="zukato-workspace-navigation-groups">
        {GROUPS.map((group) => {
          const entries = visibleItems.filter((item) => workspaceGroup(item.id) === group);
          return entries.length ? <div className="spotify-toolkit-navigation__group" key={group}>
            <span className="spotify-toolkit-navigation__group-label">{t(`navigation.${group}`)}</span>
            <div className="spotify-toolkit-navigation__buttons">
              {entries.map((item) => {
                const isActive = item.id === activeFeatureId;
                const isPinned = pins.includes(item.id);
                return <div className="spotify-toolkit-navigation__entry" key={item.id}>
                  <button type="button"
                    className={isActive
                      ? "spotify-toolkit-navigation__item spotify-toolkit-navigation__item--active"
                      : "spotify-toolkit-navigation__item"}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onSelect(item.id)}>{item.title}</button>
                  <button type="button" className="spotify-toolkit-navigation__pin"
                    aria-label={t(isPinned ? "navigation.unpin" : "navigation.pin", { title: item.title })}
                    title={t(isPinned ? "navigation.unpin" : "navigation.pin", { title: item.title })}
                    aria-pressed={isPinned} disabled={!isPinned && atPinLimit}
                    onClick={() => togglePin(item.id)}>{isPinned ? "★" : "☆"}</button>
                </div>;
              })}
            </div>
          </div> : null;
        })}
        {visibleItems.length === 0 && <p className="spotify-toolkit-navigation__empty" role="status">
          {t("navigation.noResults")}
        </p>}
        {atPinLimit && <small className="spotify-toolkit-navigation__pin-hint">
          {t("navigation.pinLimit", { count: WORKSPACE_PIN_LIMIT })}
        </small>}
      </div>}
    </nav>
  );
}
