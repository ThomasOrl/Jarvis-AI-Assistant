/**
 * Dictée au micro.
 *
 * Déroulé : micro → échantillons audio → fichier WAV → `/api/transcribe`
 * → texte renvoyé à l'appelant via `onTranscript`.
 *
 * Le WAV est fabriqué à la main (plutôt que d'utiliser l'enregistreur du
 * navigateur) car les formats produits par défaut diffèrent d'un navigateur à
 * l'autre, alors que le WAV 16 kHz est accepté partout.
 */
import { useCallback, useRef, useState } from "react";

/** Fréquence attendue par le service de transcription (Hz). */
const TARGET_SAMPLE_RATE = 16000;

/** Taille de bloc de capture : compromis latence / stabilité. */
const BUFFER_SIZE = 4096;

/** En dessous de cette taille, l'enregistrement est considéré comme vide (octets). */
const MIN_BLOB_BYTES = 4096;

/**
 * Assemble les échantillons captés en un fichier WAV mono 16 bits,
 * ramené à `targetRate` (rééchantillonnage simple par sélection).
 */
function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = TARGET_SAMPLE_RATE) {
  // 1. Concaténer tous les blocs captés.
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  // 2. Réduire la fréquence et convertir en entiers 16 bits.
  const ratio = sampleRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)] ?? 0));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // 3. Écrire l'en-tête WAV (44 octets) puis les données.
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true); // taille du fichier - 8
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // format PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true); // octets par seconde
  view.setUint16(32, 2, true); // octets par échantillon
  view.setUint16(34, 16, true); // bits par échantillon
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);

  return new Blob([buffer], { type: "audio/wav" });
}

/** `idle` = au repos, `recording` = en écoute, `transcribing` = envoi en cours. */
type State = "idle" | "recording" | "transcribing";

export function useDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  /** Matériel audio actif ; `null` hors enregistrement. */
  const ref = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    node: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    chunks: Float32Array[];
  } | null>(null);

  /** Demande le micro et commence à accumuler l'audio. */
  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));

      source.connect(node);
      node.connect(ctx.destination);

      ref.current = { stream, ctx, node, source, chunks };
      setState("recording");
    } catch {
      setError("Micro inaccessible. Autorisez l'accès au microphone.");
      setState("idle");
    }
  }, []);

  /** Arrête le micro, envoie l'audio et transmet le texte reconnu. */
  const stop = useCallback(async () => {
    const current = ref.current;
    if (!current) return;
    ref.current = null;

    // Libération du micro et du circuit audio.
    current.stream.getTracks().forEach((t) => t.stop());
    current.node.disconnect();
    current.source.disconnect();
    const blob = encodeWav(current.chunks, current.ctx.sampleRate);
    await current.ctx.close();

    if (blob.size < MIN_BLOB_BYTES) {
      setError("Rien n'a été capté. Réessayez.");
      setState("idle");
      return;
    }

    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text().catch(() => ""));

      const data = (await res.json()) as { text?: string };
      if (data.text?.trim()) onTranscript(data.text.trim());
      else setError("Aucune parole détectée.");
    } catch {
      setError("Transcription impossible pour le moment.");
    } finally {
      setState("idle");
    }
  }, [onTranscript]);

  /** Bouton micro : démarre ou arrête selon l'état courant. */
  const toggle = useCallback(() => {
    if (state === "recording") void stop();
    else if (state === "idle") void start();
  }, [state, start, stop]);

  return { state, error, toggle };
}
