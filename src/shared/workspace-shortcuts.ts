// =============================================================================
// Datei: src/shared/workspace-shortcuts.ts
// Zweck: Globales Kürzel für die Schnellsuche nur dann auslösen, wenn keine
//        Eingabe, anderer Dialog oder bereits behandelte Taste gestört wird.
// Wo ändern? Tastenregel hier, Eventlistener in custom-app/App.tsx.
// =============================================================================

/** Die Erkennung ist absichtlich DOM-neutral testbar, benötigt keine Browser-API. */
interface KeyboardContext {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
}

/** Auch contenteditable und modale Fremdfenster respektieren. */
function isEditingOrDialog(target: EventTarget | null): boolean {
  const candidate = target as { closest?: (query: string) => Element | null } | null;
  return typeof candidate?.closest === "function" && Boolean(candidate.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [aria-modal="true"]',
  ));
}

/** Modifier allein bzw. gedrückt gehaltene Tasten starten die Schnellsuche nie. */
export function shouldToggleQuickTrackPanel(event: KeyboardContext): boolean {
  return event.code === "KeyF" && event.ctrlKey && event.shiftKey &&
    !event.altKey && !event.metaKey && !event.repeat &&
    !event.defaultPrevented && !event.isComposing &&
    !isEditingOrDialog(event.target);
}
