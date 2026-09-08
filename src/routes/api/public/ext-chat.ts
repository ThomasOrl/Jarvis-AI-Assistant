/** Point d'entrée utilisé par l'extension Jarvis (Chrome / Safari). */
import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";

import { SYSTEM_PROMPT } from "@/lib/jarvis-prompt";

type ChatTurn = { role: "user" | "assistant"; content: string };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function readTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        typeof t === "object" &&
        ((t as ChatTurn).role === "user" || (t as ChatTurn).role === "assistant") &&
        typeof (t as ChatTurn).content === "string" &&
        (t as ChatTurn).content.trim().length > 0,
    )
    .slice(-20)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));
}

export const Route = createFileRoute("/api/public/ext-chat")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
        const messages = readTurns(body?.messages);
        if (messages.length === 0) {
          return new Response("Messages requis", { status: 400, headers: CORS });
        }

        const customBaseUrl = process.env["AI_BASE_URL"];
        const apiKey = process.env["AI_API_KEY"];
        if (!apiKey) {
          return new Response("Clé d'accès au moteur d'IA manquante (AI_API_KEY)", {
            status: 500,
            headers: CORS,
          });
        }
        const model = process.env["AI_MODEL"] ?? "gemini-2.5-flash";

        const provider = createOpenAI({
          apiKey,
          ...(customBaseUrl ? { baseURL: customBaseUrl } : {}),
        });

        const result = streamText({
          model: provider.chat(model),
          system: SYSTEM_PROMPT,
          messages,
          abortSignal: request.signal,
        });

        return result.toTextStreamResponse({
          headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
