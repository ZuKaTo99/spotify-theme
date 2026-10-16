// =============================================================================
// Datei: wallpaper-export.ts
// Zweck: Komplette HTML-Projekte unverändert als ZIP zurückgeben.
// Wo ändern? ZIP32-Container und Prüfnummern; keine Drittanbieter-Bibliothek.
// Die Dateien werden nicht als ein HTML mit Base64 exportiert: alle relativen
// Pfade und Originaldaten bleiben erhalten, auch 3D-Modelle und Fonts.
// =============================================================================
import type { ProjectAsset } from "./wallpaper-project";

const CRC_POLYNOMIAL = 0xedb88320;

/** CRC-32 in 1-MiB-Stücken berechnen; selbst große Files bleiben sparsam. */
async function crc32(blob: Blob): Promise<number> {
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += 1024 * 1024) {
    const bytes = new Uint8Array(await blob.slice(offset, offset + 1024 * 1024).arrayBuffer());
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? CRC_POLYNOMIAL : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Little-Endian ZIP32-Felder ohne Zusatzpaket schreiben. */
function words(size: number): DataView {
  return new DataView(new ArrayBuffer(size));
}

export async function zipWallpaperProject(files: readonly ProjectAsset[]): Promise<Blob> {
  if (files.length > 65535) throw new Error("Zu viele Dateien für das ZIP-Format.");
  // Im Test-Virtual-Machine-Kontext existiert TextEncoder teils erst zur Laufzeit.
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const { path, blob } of files) {
    const name = encoder.encode(path);
    if (name.length > 65535 || blob.size >= 0xffffffff || offset >= 0xffffffff)
      throw new Error("Wallpaper-ZIP überschreitet das unterstützte ZIP32-Format.");
    const checksum = await crc32(blob);
    const local = words(30);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8-Dateinamen
    local.setUint32(14, checksum, true);
    local.setUint32(18, blob.size, true);
    local.setUint32(22, blob.size, true);
    local.setUint16(26, name.byteLength, true);
    chunks.push(local.buffer, name, blob);
    const entry = words(46);
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, checksum, true);
    entry.setUint32(20, blob.size, true);
    entry.setUint32(24, blob.size, true);
    entry.setUint16(28, name.byteLength, true);
    entry.setUint32(42, offset, true);
    central.push(entry.buffer, name);
    centralSize += 46 + name.byteLength;
    offset += 30 + name.byteLength + blob.size;
  }
  if (offset + centralSize >= 0xffffffff) throw new Error("Wallpaper-ZIP zu groß.");
  const trailer = words(22);
  trailer.setUint32(0, 0x06054b50, true);
  trailer.setUint16(8, files.length, true);
  trailer.setUint16(10, files.length, true);
  trailer.setUint32(12, centralSize, true);
  trailer.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, trailer.buffer], { type: "application/zip" });
}
