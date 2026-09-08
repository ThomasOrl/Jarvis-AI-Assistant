# Extension Chrome J.A.R.V.I.S.

Une petite fenêtre Jarvis accessible depuis la barre d'outils du navigateur :
chat en français + lecture à voix haute par la voix intégrée du navigateur.

## Installation (mode développeur)

1. Ouvrir `chrome://extensions` dans Chrome (ou Edge, Brave, Opera…).
2. Activer **Mode développeur** (en haut à droite).
3. Cliquer **Charger l'extension non empaquetée** et choisir ce dossier `extension/`.
4. Épingler l'icône Jarvis dans la barre d'outils.

## Réglage important

Dans `popup.js`, la constante `ENDPOINT` doit pointer vers votre site :

```js
const ENDPOINT = "https://jarvis-is-your-ai.netlify.app/api/public/ext-chat";
```

Si vous branchez votre nom de domaine (ex. `https://jarvisai.be`), modifiez cette
ligne **et** `host_permissions` dans `manifest.json`.

Aucune clé d'API n'est stockée dans l'extension : c'est le site qui parle au
moteur d'IA.
