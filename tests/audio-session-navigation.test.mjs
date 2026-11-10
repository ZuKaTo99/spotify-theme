import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const entry = fileURLToPath(new URL("../src/custom-app/modules/visualizer/audio-session.ts", import.meta.url));
const compiled = await build({ entryPoints: [entry], bundle: true, format: "esm",
  platform: "browser", write: false });
const { AudioCaptureSession } = await import(`data:text/javascript,${encodeURIComponent(compiled.outputFiles[0].text)}`);

test("Audiofreigabe überlebt Seitenwechsel und endet erst bei Stop oder Spur-Ende", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalContext = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  let grants = 0;
  let closed = 0;
  const makeTrack = () => {
    const listeners = new Set();
    return { readyState: "live", stopped: 0,
      addEventListener(event, listener) { if (event === "ended") listeners.add(listener); },
      removeEventListener(event, listener) { if (event === "ended") listeners.delete(listener); },
      stop() { this.stopped++; this.readyState = "ended"; },
      end() { this.readyState = "ended"; for (const listener of [...listeners]) listener(); },
    };
  };
  const audio = makeTrack();
  const video = makeTrack();
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [video], getTracks: () => [audio, video] };
  class FakeAudioContext {
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0 }; }
    createMediaStreamSource() { return { connect() {} }; }
    async resume() {}
    async close() { closed++; }
  }
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    mediaDevices: { async getDisplayMedia() { grants++; return stream; } },
  } });
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext });
  try {
    const session = new AudioCaptureSession();
    const firstPage = [];
    const leave = session.subscribe(() => firstPage.push(session.snapshot()));
    await session.start("system", 0.7);
    assert.equal(session.snapshot().source, "system");
    assert.equal(grants, 1);
    leave(); // Home oder Einstellungen: React-Visualizer wird ausgehängt.
    assert.equal(audio.stopped, 0);
    assert.equal(video.stopped, 0);
    const secondPage = [];
    const leaveAgain = session.subscribe(() => secondPage.push(session.snapshot()));
    assert.equal(secondPage.at(-1).resources?.stream, stream);
    await session.start("system", 0.7);
    assert.equal(grants, 1, "Zurückkehren darf keinen neuen Freigabedialog öffnen");
    leaveAgain();
    audio.end();
    assert.equal(session.snapshot().resources, null);
    assert.match(session.snapshot().error, /beendet/);
    assert.equal(video.stopped, 1);
    assert.equal(closed, 1);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (originalContext) Object.defineProperty(globalThis, "AudioContext", originalContext);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});
