/**
 * Voix de Jarvis : transforme un texte en audio (synthèse vocale).
 *
 * Service optionnel et payant. Sans les variables VOICE_* dans le fichier
 * `.env`, cette route répond 501 et le navigateur prend le relais avec sa
 * propre voix (gratuite) : voir `src/hooks/use-voice.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";

type SpeechBody = { text?: unknown };

export const Route = createFileRoute("/api/speech")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as SpeechBody | null;
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          return new Response("Texte requis", { status: 400 });
        }

        const apiKey = process.env["VOICE_API_KEY"];
        if (!apiKey) {
          // 501 = « non configuré » : le navigateur lira le texte lui-même.
          return new Response("Voix de synthèse non configurée", { status: 501 });
        }
        const baseUrl = (process.env["VOICE_BASE_URL"] ?? "https://api.openai.com/v1").replace(
          /\/$/,
          "",
        );
        const model = process.env["VOICE_MODEL"] ?? "gpt-4o-mini-tts";

        try {
          const response = await fetch(`${baseUrl}/audio/speech`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              input: text,
              // Voix « fable » : timbre masculin posé.
              voice: "fable",
              speed: 1.05,
              instructions:
                "Tu es Jarvis, le majordome électronique de Tony Stark, incarné par un homme britannique d'âge mûr. Voix masculine raffinée, accent britannique élégant et posé, immense politesse, finesse et une pointe d'humour pince-sans-rire. Débit naturel et fluide, articulation soignée, en français.",
              response_format: "mp3",
            }),
            signal: request.signal,
          });

          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            return new Response(
              `Synthèse vocale impossible (${response.status})${detail ? `: ${detail}` : ""}`,
              { status: response.status },
            );
          }

          // L'audio est renvoyé tel quel au navigateur, sans le stocker.
          return new Response(response.body, {
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
          });
        } catch (err) {
          // L'utilisateur a coupé la lecture : ce n'est pas une erreur.
          if (request.signal.aborted) {
            return new Response(null, { status: 499 });
          }
          throw err;
        }
      },
    },
  },
});
