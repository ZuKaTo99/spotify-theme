import type {
  FeatureId,
} from "./features";

import type {
  TranslationKey,
  Translator,
} from "./i18n";

const FEATURE_TITLE_KEYS = {
  "dashboard": "feature.dashboard",
  "listening-history":
    "feature.listening-history",
  "statistics": "feature.statistics",
  "favorites": "feature.favorites",
  "playlist-tools":
    "feature.playlist-tools",
  "visualizer": "feature.visualizer",
  "song-notes": "feature.song-notes",
  "theme-studio": "feature.theme-studio",
  "settings": "feature.settings",

  "keyboard-shortcuts":
    "feature.keyboard-shortcuts",
  "sleep-timer":
    "feature.sleep-timer",
  "volume-scroll":
    "feature.volume-scroll",
  "copy-track-info":
    "feature.copy-track-info",
  "quick-playlist":
    "feature.quick-playlist",
  "mini-player":
    "feature.mini-player",
  "player-statistics":
    "feature.player-statistics",
  "context-actions":
    "feature.context-actions",
} satisfies Record<
  FeatureId,
  TranslationKey
>;

export function getDefaultFeatureTitle(
  featureId: FeatureId,
  t: Translator,
): string {
  return t(
    FEATURE_TITLE_KEYS[featureId],
  );
}

export function getFeatureTitle(
  featureId: FeatureId,
  customTitle: string,
  t: Translator,
): string {
  const normalizedTitle =
    customTitle.trim();

  return normalizedTitle ||
    getDefaultFeatureTitle(
      featureId,
      t,
    );
}