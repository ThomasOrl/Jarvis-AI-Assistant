/**
 * Configuration du moteur d'IA (côté serveur uniquement).
 *
 * Renseignez ces variables dans un fichier `.env` à la racine du projet :
 *   AI_API_KEY   : votre clé d'accès (ex. sk-... pour OpenAI)
 *   AI_BASE_URL  : adresse de l'API compatible OpenAI
 *   AI_MODEL     : modèle de conversation
 *   AI_TTS_MODEL : modèle de synthèse vocale
 *   AI_STT_MODEL : modèle de transcription
 */
export function aiConfig() {
  return {
    apiKey: process.env["AI_API_KEY"] ?? "",
    baseUrl: (process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env["AI_MODEL"] ?? "gpt-4o-mini",
    ttsModel: process.env["AI_TTS_MODEL"] ?? "gpt-4o-mini-tts",
    sttModel: process.env["AI_STT_MODEL"] ?? "gpt-4o-mini-transcribe",
  };
}
