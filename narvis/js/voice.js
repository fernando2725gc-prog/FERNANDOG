// Voz de Narvis con la síntesis del navegador (gratis, sin internet extra).
// Las voces más naturales son las "neuronales": en Microsoft Edge se llaman
// "… Online (Natural)"; en Chrome, "Google español…"; en Mac, las "Mejoradas/Premium".

const LOCALE_SCORE = { "es-MX": 30, "es-US": 26, "es-419": 24, "es-ES": 18 };

// Puntúa una voz: más alto = más natural y más cercana al español de México.
export function rankVoice(voice) {
  if (!voice?.lang?.toLowerCase().startsWith("es")) return -1;
  const name = voice.name.toLowerCase();
  let score = LOCALE_SCORE[voice.lang] ?? 10;
  if (/natural|neural/.test(name)) score += 100;
  else if (/premium|enhanced|mejorad/.test(name)) score += 80;
  else if (/online/.test(name)) score += 60;
  else if (/google/.test(name)) score += 50;
  if (!voice.localService) score += 5; // las voces en la nube suelen sonar mejor
  return score;
}

export function bestVoices(voices) {
  return voices
    .map((voice) => ({ voice, score: rankVoice(voice) }))
    .filter((v) => v.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((v) => v.voice);
}

export function voiceQuality(voice) {
  const score = rankVoice(voice);
  return score >= 120 ? "natural" : score >= 70 ? "buena" : "básica";
}

// Divide en frases cortas: Chrome corta las locuciones largas y así suena más fluido.
export function splitSentences(text, max = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [clean];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      chunks.push(current.trim());
      current = "";
    }
    if (s.length > max) {
      // Frase muy larga: corta en comas.
      for (const part of s.split(/(?<=,)\s/)) {
        if ((current + part).length > max && current) {
          chunks.push(current.trim());
          current = "";
        }
        current += `${part} `;
      }
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function createVoice({ getSettings, onState = () => {} }) {
  const synth = window.speechSynthesis;
  let voices = [];
  let generation = 0;

  const refresh = () => {
    voices = synth ? bestVoices(synth.getVoices()) : [];
  };
  if (synth) {
    refresh();
    synth.addEventListener?.("voiceschanged", refresh);
  }

  const current = () => {
    const { voiceURI } = getSettings();
    return voices.find((v) => v.voiceURI === voiceURI) ?? voices[0] ?? null;
  };

  return {
    available: Boolean(synth),
    list: () => voices,
    current,
    stop() {
      generation++;
      synth?.cancel();
      onState(false);
    },
    // Habla frase por frase; una nueva llamada interrumpe la anterior.
    speak(text, { force = false } = {}) {
      const settings = getSettings();
      if (!synth || !text || (!settings.voice && !force)) return;
      const run = ++generation;
      synth.cancel();
      const voice = current();
      const chunks = splitSentences(text);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = voice?.lang ?? "es-MX";
        if (voice) u.voice = voice;
        u.rate = settings.rate ?? 1;
        u.pitch = settings.pitch ?? 1;
        if (i === 0) u.onstart = () => run === generation && onState(true);
        if (i === chunks.length - 1) u.onend = u.onerror = () => run === generation && onState(false);
        synth.speak(u);
      });
    }
  };
}
