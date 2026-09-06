/**
 * Dictée : reçoit un enregistrement audio et renvoie le texte reconnu.
 *
 * Service optionnel et payant (variables VOICE_* dans `.env`).
 * Sans clé, le bouton micro affiche un message clair.
 */
import { createFileRoute } from "@tanstack/react-router";

/** Taille maximale acceptée pour un enregistrement : 20 Mo. */
const MAX_BYTES = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["VOICE_API_KEY"];
        if (!apiKey) {
          return new Response(
            "Dictée non configurée : ajoutez VOICE_API_KEY dans votre fichier .env",
            { status: 501 },
          );
        }
        const baseUrl = (process.env["VOICE_BASE_URL"] ?? "https://api.openai.com/v1").replace(
          /\/$/,
          "",
        );
        const model = process.env["TRANSCRIBE_MODEL"] ?? "gpt-4o-mini-transcribe";

        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size < 2048) {
          return new Response("Enregistrement vide ou invalide", { status: 400 });
        }
        if (audio.size > MAX_BYTES) {
          return new Response("Enregistrement trop long", { status: 413 });
        }

        const upstream = new FormData();
        upstream.append("model", model);
        upstream.append("file", audio, "recording.wav");

        const response = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return new Response(detail || "Transcription impossible", { status: response.status });
        }

        const data = (await response.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
