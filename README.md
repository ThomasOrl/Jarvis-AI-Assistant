# J.A.R.V.I.S.

Interface d'assistant holographique : React 19 + TypeScript, TanStack Start, Tailwind CSS.

## Démarrer

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrez http://localhost:8080

## Configuration

Le fichier `.env` est déjà rempli avec votre clé Google Gemini (gratuite) :

```
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY=votre clé
AI_MODEL=gemini-3.6-flash
```

Important : après toute modification du `.env`, arrêtez le serveur (Ctrl+C) et relancez `npm run dev`.

Pour changer de fournisseur (Groq, OpenRouter, Ollama, OpenAI), voir `.env.example`.

## Voix

- La lecture à voix haute fonctionne d'office avec la voix du navigateur (gratuite) — bouton haut-parleur.
- Pour une voix de synthèse plus réaliste et pour la dictée au micro, ajoutez `VOICE_API_KEY` dans `.env` (service payant).

## Structure

```
src/routes/index.tsx              page d'accueil
src/routes/api/chat.ts            conversation (flux de texte)
src/routes/api/speech.ts          synthèse vocale (optionnelle)
src/routes/api/transcribe.ts      dictée (optionnelle)
src/components/jarvis/            réacteur, chat, widgets
src/hooks/use-voice.ts            lecture à voix haute
src/hooks/use-dictation.ts        enregistrement micro
src/lib/ai-config.ts              lecture du .env
src/styles.css                    thème et animations
```

## Scripts

| Commande          | Rôle                       |
| ----------------- | -------------------------- |
| `npm run dev`     | serveur de développement   |
| `npm run build`   | version de production      |
| `npm run preview` | prévisualiser la build     |
| `npm run lint`    | vérification du code       |
