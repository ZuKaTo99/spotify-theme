// =============================================================================
// Datei: src/custom-app/modules/dashboard/Dashboard.tsx
// Zweck: Dashboard mit einer Übersicht über aktivierte Custom-App- und Extension-Module.
// =============================================================================
import type { ReactElement } from "react";
import { currentTrack, toggleFavorite } from "../../../shared/library";
import { useToolkitData } from "../../hooks/useToolkitData";
import { TrackList } from "../../components/TrackList";

import type {
  FeaturePreferences,
} from "../../../shared/feature-preferences";

import {
  getEnabledFeaturesBySurface,
} from "../../../shared/features";

import type {
  Translator,
} from "../../../shared/i18n";

// -----------------------------------------------------------------------------
// Datenvertrag `DashboardProps` für diesen Bereich des Projekts.
// -----------------------------------------------------------------------------
interface DashboardProps {
  features: FeaturePreferences;
  t: Translator;
}

// -----------------------------------------------------------------------------
// Zeigt eine kompakte Übersicht über aktivierte Custom-App- und Extension-Features.
// -----------------------------------------------------------------------------
export function Dashboard({
  features,
  t,
}: DashboardProps): ReactElement {
  const workspaceModuleCount =
    getEnabledFeaturesBySurface(
      "custom-app",
      features,
    ).length;

  const extensionModuleCount =
    getEnabledFeaturesBySurface(
      "extension",
      features,
    ).length;

  // Daten aus derselben zentralen Bibliothek wie Hörverlauf, Notizen und Favoriten.
  const { history, favorites, notes } = useToolkitData();
  const playing = currentTrack();

  return (
    <section className="zukato-panel">
      <p>{t("dashboard.description")}</p>
      <div className="zukato-metrics">
        <div><strong>{workspaceModuleCount}</strong><span>{t("dashboard.workspaceModules")}</span></div>
        <div><strong>{extensionModuleCount}</strong><span>{t("dashboard.extensionModules")}</span></div>
        <div><strong>{history.length}</strong><span>{t("stats.changes")}</span></div>
        <div><strong>{favorites.length}</strong><span>{t("stats.favorites")}</span></div>
        <div><strong>{notes.length}</strong><span>{t("stats.notes")}</span></div>
      </div>
      {playing && <div className="zukato-current-track">
        <h3>{t("dashboard.nowPlaying")}</h3>
        <p><strong>{playing.title}</strong> — {playing.artist}</p>
        <button type="button" onClick={() => toggleFavorite(playing)}>
          {favorites.some((favorite) => favorite.uri === playing.uri) ? t("common.remove") : t("history.remember")}
        </button>
      </div>}
      <h3>{t("dashboard.recent")}</h3>
      <TrackList tracks={history.slice(0, 5)} emptyText={t("history.empty")} />
    </section>
  );
}
