/**
 * Fenêtre de l'extension Jarvis.
 *
 * Elle ne contient aucun secret : les questions sont envoyées au site Jarvis,
 * qui parle au moteur d'IA. La lecture à voix haute utilise la voix intégrée
 * du navigateur (gratuite, aucun service externe).
 */

/** Adresse du site qui répond. À changer si vous changez de domaine. */
const ENDPOINT = "https://jarvis-is-your-ai.netlify.app/api/public/ext-chat";

const HISTORY_KEY = "jarvis-history";
const VOICE_KEY = "jarvis-voice";

const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const errorBox = document.getElementById("error");
const voiceBtn = document.getElementById("voice");
const clearBtn = document.getElementById("clear");

/** Conversation en mémoire : [{ role, content }]. */
let history = [];
let voiceOn = true;
let busy = false;

// --- Affichage ------------------------------------------------------------

/** Ajoute une bulle et renvoie l'élément (pour l'alimenter pendant le flux). */
function bubble(role, text) {
  const hello = log.querySelector(".hello");
  if (hello) hello.remove();
  const el = document.createElement("div");
  el.className = `msg ${role === "user" ? "user" : "bot"}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function showError(message) {
  errorBox.textContent = message || "";
  errorBox.hidden = !message;
}

function setBusy(value) {
  busy = value;
  send.disabled = value || input.value.trim() === "";
}

/** Redessine toute la conversation (au chargement). */
function render() {
  log.innerHTML = "";
  if (history.length === 0) {
    const p = document.createElement("p");
    p.className = "hello";
    p.textContent = "Bonjour Monsieur. Que faisons nous aujourd'hui ?";
    log.appendChild(p);
    return;
  }
  history.forEach((turn) => bubble(turn.role, turn.content));
}

// --- Voix du navigateur ---------------------------------------------------

function speak(text) {
  if (!voiceOn || !text || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  const french = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  if (french) utterance.voice = french;
  window.speechSynthesis.speak(utterance);
}

function setVoice(on) {
  voiceOn = on;
  voiceBtn.setAttribute("aria-pressed", String(on));
  voiceBtn.title = on ? "Couper la voix de Jarvis" : "Faire parler Jarvis";
  if (!on && "speechSynthesis" in window) window.speechSynthesis.cancel();
  chrome.storage.local.set({ [VOICE_KEY]: on });
}

// --- Envoi ----------------------------------------------------------------

async function ask(question) {
  if (busy) return;
  showError("");
  setBusy(true);

  history.push({ role: "user", content: question });
  bubble("user", question);

  const thinking = document.createElement("p");
  thinking.className = "thinking";
  thinking.textContent = "Réflexion…";
  log.appendChild(thinking);
  log.scrollTop = log.scrollHeight;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Liaison interrompue (${response.status}).`);
    }

    thinking.remove();
    const el = bubble("assistant", "");
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let answer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      answer += value;
      el.textContent = answer;
      log.scrollTop = log.scrollHeight;
    }

    history.push({ role: "assistant", content: answer });
    chrome.storage.local.set({ [HISTORY_KEY]: history.slice(-20) });
    speak(answer);
  } catch (err) {
    thinking.remove();
    history.pop();
    showError(err && err.message ? err.message : "Liaison interrompue.");
  } finally {
    setBusy(false);
  }
}

// --- Interactions ---------------------------------------------------------

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  input.style.height = "auto";
  ask(value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  send.disabled = busy || input.value.trim() === "";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

voiceBtn.addEventListener("click", () => setVoice(!voiceOn));

clearBtn.addEventListener("click", () => {
  history = [];
  chrome.storage.local.set({ [HISTORY_KEY]: [] });
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  showError("");
  render();
});

// --- Démarrage ------------------------------------------------------------

chrome.storage.local.get([HISTORY_KEY, VOICE_KEY], (saved) => {
  history = Array.isArray(saved[HISTORY_KEY]) ? saved[HISTORY_KEY] : [];
  setVoice(saved[VOICE_KEY] !== false);
  render();
  send.disabled = true;
  input.focus();
});
