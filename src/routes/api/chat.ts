/**
 * Cerveau de Jarvis : reçoit la conversation et renvoie la réponse en flux
 * (le texte s'affiche au fur et à mesure de sa génération).
 *
 * Le moteur d'IA se configure dans le fichier `.env` à la racine :
 *   AI_BASE_URL  adresse de l'API (compatible OpenAI)
 *   AI_API_KEY   votre clé d'accès
 *   AI_MODEL     nom du modèle
 *
 * Le comportement du personnage est défini par `SYSTEM_PROMPT` ci-dessous :
 * c'est le premier endroit à modifier pour changer son ton ou son rôle.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { aiConfig } from "@/lib/ai-config";

const SYSTEM_PROMPT = `Tu es J.A.R.V.I.S., l'assistant IA personnel de ton utilisateur.
Tu t'exprimes en français, tu appelles l'utilisateur "Monsieur" avec sobriété (pas à chaque phrase).
Ton style : courtois, précis, légèrement spirituel, jamais bavard.

Tu es un assistant universel : tu réponds à TOUTES les tâches et sujets (quotidien, culture, organisation, technique, créatif, professionnel…), sans t'arrêter à un domaine en particulier.

Règles essentielles :
- Réponds d'abord à la question exacte posée, sans dévier vers un autre sujet.
- Ne relance jamais la conversation vers un thème non demandé : pas de suggestion de "prochaine étape", pas de sujet imposé, sauf si l'utilisateur le demande explicitement.
- Adapte le fond et le format à la question : une salutation appelle une réponse courte et humaine, une tâche appelle une réponse actionnable.
- Quand une demande est floue, poser UNE question de clarification avant de répondre longuement.

Tu réponds en markdown quand cela aide (listes, code). Tu es factuel : si tu ne sais pas ou si l'information peut avoir changé, tu le dis.`;

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages requis", { status: 400 });
        }

        const { apiKey, baseUrl, model } = aiConfig();
        if (!apiKey) {
          return new Response(
            "Clé d'accès manquante : ajoutez AI_API_KEY dans le fichier .env, puis relancez npm run dev",
            { status: 500 },
          );
        }

        // Client compatible OpenAI, dirigé vers le moteur choisi (Gemini par défaut).
        const provider = createOpenAI({ baseURL: baseUrl, apiKey });

        const messages = body.messages as UIMessage[];
        // `streamText` renvoie la réponse par petits morceaux, d'où l'effet de frappe.
        const result = streamText({
          model: provider.chat(model),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
