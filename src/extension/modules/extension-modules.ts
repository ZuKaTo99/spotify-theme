// =============================================================================
// Datei: src/extension/modules/extension-modules.ts
// Zweck: Zentrale Registry aller Extension-Module.
// =============================================================================
import {
  contextActionsModule,
} from "./context-actions/ContextActionsModule";

import {
  copyTrackInfoModule,
} from "./copy-track-info/CopyTrackInfoModule";

import type {
  ExtensionModule,
} from "./ExtensionModule";

import {
  keyboardShortcutsModule,
} from "./keyboard-shortcuts/KeyboardShortcutsModule";

import {
  miniPlayerModule,
} from "./mini-player/MiniPlayerModule";

import {
  playerStatisticsModule,
} from "./player-statistics/PlayerStatisticsModule";

import {
  quickPlaylistModule,
} from "./quick-playlist/QuickPlaylistModule";

import {
  sleepTimerModule,
} from "./sleep-timer/SleepTimerModule";

import {
  volumeScrollModule,
} from "./volume-scroll/VolumeScrollModule";

// -----------------------------------------------------------------------------
// Zentrale Registry aller Module, die vom ExtensionModuleManager verwaltet werden.
// -----------------------------------------------------------------------------
export const extensionModules:
  readonly ExtensionModule[] = [
    keyboardShortcutsModule,
    sleepTimerModule,
    volumeScrollModule,
    copyTrackInfoModule,
    quickPlaylistModule,
    miniPlayerModule,
    playerStatisticsModule,
    contextActionsModule,
  ];