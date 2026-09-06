/**
 * Voix de Jarvis (lecture à voix haute des réponses).
 *
 * Déroulé complet :
 *   texte markdown → texte lisible → découpé en morceaux
 *   → chaque morceau envoyé à `/api/speech` → audio joué à la suite.
 *
 * Deux contraintes des navigateurs expliquent la structure du code :
 * 1. l'audio ne démarre qu'après un geste de l'utilisateur → `unlock()` prépare
 *    le lecteur lors d'un clic ;
 * 2. un texte trop long est refusé par le moteur vocal → on le découpe.
 */
import { useCallback, useRef, useState } from "react";

/** Longueur maximale d'un morceau envoyé au moteur vocal (en mots). */
const MAX_WORDS_PER_CHUNK = 300;

/** Fichier audio silencieux, joué pour « débloquer » la lecture (Safari). */
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYaWiJ9WAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxDsDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

/** Découpe un texte long en morceaux courts, en coupant de préférence entre deux phrases. */
function chunkForTTS(text: string): string[] {
  const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    // Phrase à elle seule trop longue : on la coupe par paquets de mots.
    if (wordCount(sentence) > MAX_WORDS_PER_CHUNK) {
      flush();
      const words = sentence.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += MAX_WORDS_PER_CHUNK) {
        chunks.push(words.slice(i, i + MAX_WORDS_PER_CHUNK).join(" "));
      }
      continue;
    }
    // Sinon on remplit le morceau courant jusqu'à la limite.
    if (current && wordCount(current) + wordCount(sentence) > MAX_WORDS_PER_CHUNK) flush();
    current += sentence;
  }
  flush();

  return chunks;
}

/** Retire la mise en forme markdown pour ne garder que du texte à dire. */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // blocs de code
    .replace(/`([^`]*)`/g, "$1") // code court
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens : on garde le libellé
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // titres
    .replace(/(\*\*|__|\*|_|~~)/g, "") // gras, italique, barré
    .replace(/^\s*[-*+]\s+/gm, "") // puces
    .replace(/^\s*\d+\.\s+/gm, "") // listes numérotées
    .replace(/\|/g, " ") // tableaux
    .replace(/\n{2,}/g, ". ") // paragraphes → pause
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Lecture de secours avec la voix intégrée du navigateur (gratuite).
 * Utilisée quand aucun service de synthèse vocale n'est configuré.
 */
function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1;
    // Voix française masculine si le système en propose une.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith("fr") && /thomas|male|homme/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("fr"));
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function useVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Lecteur audio unique, réutilisé pour tous les morceaux. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Permet d'interrompre une lecture en cours. */
  const abortRef = useRef<AbortController | null>(null);
  /** Adresses temporaires des sons à libérer après usage. */
  const urlsRef = useRef<string[]>([]);
  /** Vrai quand le serveur n'a pas de service vocal : on utilise le navigateur. */
  const browserVoiceRef = useRef(false);

  /** Prépare le lecteur audio pendant un clic : les navigateurs l'exigent. */
  const unlock = useCallback(async () => {
    if (typeof window === "undefined") return null;

    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "auto";
      audioRef.current = el;
    }
    const el = audioRef.current;

    try {
      // Un court silence joué au moment du clic autorise les lectures suivantes.
      el.muted = true;
      el.src = SILENT_MP3;
      await el.play().catch(() => {});
      el.pause();
      el.muted = false;
      el.currentTime = 0;
    } catch {
      /* pas grave : on réessaiera au prochain geste de l'utilisateur */
    }

    return el;
  }, []);

  /** Coupe la lecture et libère les ressources. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }

    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setSpeaking(false);
  }, []);

  /** Lit un texte à voix haute, morceau par morceau. */
  const speak = useCallback(
    async (rawText: string) => {
      stop(); // une seule lecture à la fois

      const text = stripMarkdown(rawText);
      if (!text) return;

      const el = (await unlock()) ?? audioRef.current;
      if (!el) {
        setError("Votre navigateur ne permet pas la lecture audio.");
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setSpeaking(true);
      setError(null);

      try {
        for (const chunk of chunkForTTS(text)) {
          // Une nouvelle lecture a été lancée entre-temps : on abandonne.
          if (abortRef.current !== controller) break;

          // Aucun service vocal configuré : la voix du navigateur suffit.
          if (browserVoiceRef.current) {
            await speakWithBrowser(chunk);
            continue;
          }

          const res = await fetch("/api/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk }),
            signal: controller.signal,
          });
          if (res.status === 501) {
            // Le serveur n'a pas de voix « premium » : on bascule définitivement
            // sur celle du navigateur, sans afficher d'erreur.
            browserVoiceRef.current = true;
            await speakWithBrowser(chunk);
            continue;
          }
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(detail || `Erreur ${res.status}`);
          }

          const blob = await res.blob();
          if (abortRef.current !== controller) break;
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);

          // Attend la fin du morceau avant de demander le suivant.
          await new Promise<void>((resolve, reject) => {
            el.onended = () => resolve();
            el.onerror = () => reject(new Error("Lecture audio impossible"));
            el.src = url;
            el.play().then(
              () => undefined,
              (err) => reject(err),
            );
          });

          URL.revokeObjectURL(url);
          urlsRef.current = urlsRef.current.filter((u) => u !== url);
        }
      } catch {
        // Une interruption volontaire n'est pas une erreur à afficher.
        if (!controller.signal.aborted) {
          setError("La voix de Jarvis est indisponible pour le moment.");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setSpeaking(false);
        }
      }
    },
    [stop, unlock],
  );

  return { speaking, error, speak, stop, setError, unlock };
}
