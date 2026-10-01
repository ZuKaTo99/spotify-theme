import type {
  ReactElement,
} from "react";

import type {
  FeatureId,
} from "../../shared/features";

import type {
  Translator,
} from "../../shared/i18n";

import type {
  AppSettings,
} from "../../shared/settings";

import {
  Statistics,
} from "../modules/statistics/Statistics";

import {
  ListeningHistory,
} from "../modules/listening-history/ListeningHistory";

import {
  ModulePlaceholder,
} from "./ModulePlaceholder";

import {
  Favorites,
} from "../modules/favorites/Favorites";

import {
  PlaylistTools,
} from "../modules/playlist-tools/PlaylistTools";

import {
  Visualizer,
} from "../modules/visualizer/Visualizer";

import {
  SongNotes,
} from "../modules/song-notes/SongNotes";

import {
  ThemeStudio,
} from "../modules/theme-studio/ThemeStudio";

import type {
  SettingsChanges,
} from "../hooks/useSettings";

import {
  Dashboard,
} from "../modules/dashboard/Dashboard";

import {
  SettingsModule,
} from "../modules/settings/SettingsModule";

interface ModuleContentProps {
  featureId: FeatureId;
  settings: AppSettings;
  t: Translator;

  onSettingsChange: (
    changes: SettingsChanges,
  ) => void;
}

export function ModuleContent({
  featureId,
  settings,
  t,
  onSettingsChange,
}: ModuleContentProps): ReactElement {
  if (featureId === "settings") {
    return (
      <SettingsModule
        settings={settings}
        t={t}
        onChange={onSettingsChange}
      />
    );
  }

  if (featureId === "dashboard") {
    return (
      <Dashboard
        features={settings.features}
        t={t}
      />
    );
  }

  if (featureId === "listening-history") {
    return (
      <ListeningHistory
        t={t}
      />
    );
  }

  if (featureId === "statistics") {
    return (
      <Statistics
        t={t}
      />
    );

    if (featureId === "favorites") {
      return (
        <Favorites
          t={t}
        />
      );
    }

    if (featureId === "playlist-tools") {
      return (
        <PlaylistTools
          t={t}
        />
      );
    }

    if (featureId === "visualizer") {
      return (
        <Visualizer
          t={t}
        />
      );
    }

    if (featureId === "song-notes") {
      return (
        <SongNotes
          t={t}
        />
      );
    }

    if (featureId === "theme-studio") {
      return (
        <ThemeStudio
          t={t}
        />
      );
    }

  }

  return (
    <ModulePlaceholder
      t={t}
    />
  );
}