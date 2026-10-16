// =============================================================================
// Datei: wallpaper-frame-gate.ts
// Zweck: Doppeltes Senden hunderter Wallpaper-Blobs beim iframe-Laden vermeiden
// und nach einer echten Neuinitialisierung der Sandbox trotzdem neu senden.
// Wo ändern? Nur die Lebenszyklus-/Retry-Regeln der Frame-Übergabe hier.
//
// Hintergrund: document.write() löst in Chromium ein weiteres load-Ereignis
// aus. Ein iframe kann aber auch später neu laden, OHNE dass sich der React-
// Schlüssel ändert. Ein bloßer Vergleich mit der Szenen-ID reicht dann nicht.
// =============================================================================

/** Maximal zwei echte Wiederholungen: untrusted HTML darf keine Blob-Flut auslösen. */
const MAX_TRANSFERS_PER_SCENE = 3;

export class WallpaperFrameGate {
  private sceneKey = "";
  private documentId = "";
  private transferCount = 0;

  /** Ein Song/Preview-Wechsel beginnt einen neuen isolierten Frame-Lebenszyklus. */
  private select(sceneKey: string): void {
    if (this.sceneKey === sceneKey) return;
    this.sceneKey = sceneKey;
    this.documentId = "";
    this.transferCount = 0;
  }

  /** load-Fallback für Browser, in denen die Ready-Nachricht zu früh kommt. */
  onLoad(sceneKey: string): boolean {
    this.select(sceneKey);
    if (this.transferCount !== 0) return false;
    this.transferCount += 1;
    return true;
  }

  /**
   * Der isolierte Bootstrap sendet für JEDES neue Dokument eine Kennung.
   * Die erste Kennung bestätigt den ersten Transfer; erst eine andere Kennung
   * signalisiert einen tatsächlichen erneuten Dokumentstart.
   */
  onReady(sceneKey: string, documentId: unknown): boolean {
    this.select(sceneKey);
    if (typeof documentId !== "string" || !/^[a-zA-Z0-9.:-]{1,100}$/.test(documentId)) return false;
    if (this.documentId === documentId) return false;
    if (!this.documentId && this.transferCount > 0) {
      this.documentId = documentId;
      return false;
    }
    this.documentId = documentId;
    if (this.transferCount >= MAX_TRANSFERS_PER_SCENE) return false;
    this.transferCount += 1;
    return true;
  }

  /** Misslungene Übergaben dürfen beim nächsten Ereignis wiederholt werden. */
  failed(sceneKey: string): void {
    if (sceneKey !== this.sceneKey) return;
    this.transferCount = Math.max(0, this.transferCount - 1);
  }
}
