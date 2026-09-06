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

const SYSTEM_PROMPT = `Tu es J.A.R.V.I.S., l'assistant IA personnel de ton utilisateur, un développeur front-end en apprentissage.
Tu t'exprimes en français, tu appelles l'utilisateur "Monsieur" avec sobriété (pas à chaque phrase).
Ton style : courtois, précis, légèrement spirituel, jamais bavard.

Ton rôle :
- Répondre à toute question générale (culture, technique, organisation, quotidien).
- Aider sur ses projets : cadrer une idée, proposer des étapes, suggérer des fonctionnalités, donner des retours.
- L'accompagner dans sa progression front-end : expliquer les concepts simplement, montrer du code commenté, proposer des exercices.
- Quand une demande est floue, poser UNE question de clarification avant de répondre longuement.
- Prendre des initiatives : proposer la suite logique ou une amélioration pertinente après ta réponse.

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
