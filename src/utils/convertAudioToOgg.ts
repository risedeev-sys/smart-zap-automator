/**
 * Converts any browser-supported audio file (mp3, wav, m4a, etc.)
 * to OGG/Opus format using the Web Audio API + MediaRecorder.
 *
 * This eliminates the need for server-side re-encoding by the
 * Evolution API, dramatically reducing WhatsApp audio send latency.
 *
 * If the file is already OGG/Opus, it is returned as-is.
 */

const OGG_MIME = "audio/ogg; codecs=opus";
const FALLBACK_MIME = "audio/webm; codecs=opus";

function isAlreadyOgg(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    mime.includes("ogg") ||
    mime.includes("opus") ||
    name.endsWith(".ogg") ||
    name.endsWith(".opus")
  );
}

function getSupportedMime(): string | null {
  if (MediaRecorder.isTypeSupported(OGG_MIME)) return OGG_MIME;
  if (MediaRecorder.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME;
  if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return null;
}

export async function convertAudioToOgg(file: File): Promise<File> {
  if (isAlreadyOgg(file)) return file;

  const supportedMime = getSupportedMime();
  if (!supportedMime) {
    console.warn("[convertAudioToOgg] No OGG/Opus support, returning original file");
    return file;
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();

  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn("[convertAudioToOgg] Failed to decode, returning original:", err);
    await audioCtx.close();
    return file;
  }

  const offlineCtx = new OfflineAudioContext(
    decodedBuffer.numberOfChannels,
    decodedBuffer.length,
    decodedBuffer.sampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;

  const dest = audioCtx.createMediaStreamDestination();
  const liveSource = audioCtx.createBufferSource();
  liveSource.buffer = decodedBuffer;
  liveSource.connect(dest);

  const recorder = new MediaRecorder(dest.stream, {
    mimeType: supportedMime,
    audioBitsPerSecond: 64000,
  });

  const chunks: Blob[] = [];

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: supportedMime }));
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();
  liveSource.start(0);

  // Stop recording after the audio duration + small buffer
  const durationMs = (decodedBuffer.duration * 1000) + 200;
  setTimeout(() => {
    try {
      if (recorder.state === "recording") recorder.stop();
      liveSource.stop();
    } catch { /* ignore */ }
  }, durationMs);

  let oggBlob: Blob;
  try {
    oggBlob = await recordingDone;
  } catch (err) {
    console.warn("[convertAudioToOgg] Recording failed, returning original:", err);
    await audioCtx.close();
    return file;
  }

  await audioCtx.close();

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const ext = supportedMime.includes("ogg") ? "ogg" : "webm";

  return new File([oggBlob], `${baseName}.${ext}`, {
    type: supportedMime,
    lastModified: Date.now(),
  });
}
