// =============================================================================
// Datei: src/custom-app/components/ModuleContent.tsx
// Zweck: Vollständiger Feature-Router; jede Seite liegt auf einer eigenen Ebene.
// =============================================================================
import type { ReactElement } from "react";
import type { FeatureId } from "../../shared/features";
import type { Translator } from "../../shared/i18n";
import type { AppSettings } from "../../shared/settings";
import type { SettingsChanges } from "../hooks/useSettings";
import { Dashboard } from "../modules/dashboard/Dashboard";
import { ListeningHistory } from "../modules/listening-history/ListeningHistory";
import { Statistics } from "../modules/statistics/Statistics";
import { Favorites } from "../modules/favorites/Favorites";
import { PlaylistTools } from "../modules/playlist-tools/PlaylistTools";
import { Visualizer } from "../modules/visualizer/Visualizer";
import { SongNotes } from "../modules/song-notes/SongNotes";
import { ThemeStudio } from "../modules/theme-studio/ThemeStudio";
import { SettingsModule } from "../modules/settings/SettingsModule";
import { ModulePlaceholder } from "./ModulePlaceholder";

interface ModuleContentProps {
  featureId: FeatureId;
  settings: AppSettings;
  t: Translator;
  onSettingsChange: (changes: SettingsChanges) => void;
  onNavigate: (featureId: FeatureId) => void;
}

/** Wichtig: kein verschachteltes if nach return (ursprünglicher Router-Bug). */
export function ModuleContent({ featureId, settings, t, onSettingsChange, onNavigate }: ModuleContentProps): ReactElement {
  switch (featureId) {
    case "settings": return <SettingsModule settings={settings} t={t} onChange={onSettingsChange} />;
    case "dashboard": return <Dashboard features={settings.features} t={t} onNavigate={onNavigate} />;
    case "listening-history": return <ListeningHistory t={t} />;
    case "statistics": return <Statistics t={t} />;
    case "favorites": return <Favorites t={t} />;
    case "playlist-tools": return <PlaylistTools t={t} />;
    case "visualizer": return <Visualizer t={t} />;
    case "song-notes": return <SongNotes t={t} />;
    case "theme-studio": return <ThemeStudio t={t} />;
    default: return <ModulePlaceholder t={t} />;
  }
}
