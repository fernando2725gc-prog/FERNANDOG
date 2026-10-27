// Cerebro de Narvis: arma lo que se le pregunta a Claude (instrucciones, noticias
// recientes y conversación) y limpia la respuesta para leerla en voz alta.
// Las funciones son puras; createBrain() es la única que toca window.claude.

export const TOPICS = [
  "Geopolítica",
  "Economía",
  "México",
  "Ciencia y tecnología",
  "Salud",
  "Clima y medio ambiente"
];

const MAX_HISTORY = 8; // turnos de conversación que se reenvían
const MAX_NEWS = 30;

const RULES = `Eres Narvis, un asistente personal por voz en español, sereno, preciso y directo.
Tu foco son los temas importantes: geopolítica y conflictos, economía y mercados, política de México y Latinoamérica, ciencia y tecnología (sobre todo inteligencia artificial), salud, y clima y medio ambiente.

Cómo respondes:
- Tus respuestas se leen en voz alta: texto corrido, sin markdown, sin viñetas, sin emojis, sin URLs.
- Sé breve: 2 a 4 frases (menos de 90 palabras) salvo que te pidan detalle o un resumen.
- Prioriza hechos verificables y su contexto: por qué importa y qué puede pasar después. Separa hechos de opiniones.
- Para temas de actualidad usa primero las NOTICIAS RECIENTES de abajo y menciona la fuente por su nombre. Si la pregunta es sobre algo actual que no aparece ahí, dilo y aclara que tu información puede estar desactualizada. Nunca inventes cifras ni sucesos.
- Si te piden algo trivial, contesta en una frase y, si viene al caso, conecta con algo relevante.
- Si la pregunta es ambigua, elige la interpretación más útil y responde.`;

// Frases que piden análisis: usan el modelo más capaz en lugar del rápido.
const DEEP = /\b(?:analiza|analisis|explica|explicame|por que|porque|compara|resumen|resume|impacto|consecuencias|que significa|profundiza|detalle)\b/;

export function pickTier(question, mode) {
  if (mode === "briefing") return "default";
  const clean = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return DEEP.test(clean) ? "default" : "quick";
}

function formatDate(now) {
  return now.toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

export function formatNews(news) {
  if (!news || !Array.isArray(news.items) || news.items.length === 0) {
    return "NOTICIAS RECIENTES: no hay noticias cargadas todavía.";
  }
  const items = [...news.items]
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, MAX_NEWS)
    .map((n) => `- [${n.topic}] ${n.title}. ${n.summary ?? ""} (Fuente: ${n.source}${n.date ? `, ${n.date}` : ""})`);
  return `NOTICIAS RECIENTES (actualizadas: ${news.updatedAt ?? "sin fecha"}):\n${items.join("\n")}`;
}

const BRIEFING = `Dame el resumen del día: las 4 o 5 noticias más importantes de las NOTICIAS RECIENTES, empezando por la de mayor impacto. Para cada una, una frase con lo que pasó y otra con por qué importa. Al final, una frase sobre qué vigilar. Menos de 180 palabras, en texto corrido para leer en voz alta.`;

// Construye la lista de turnos que espera sample(): empieza y termina en "user".
export function buildMessages({ question, mode, history = [], news, now = new Date() }) {
  const context = `${RULES}\n\nFecha y hora actual: ${formatDate(now)}.\n\n${formatNews(news)}`;
  const recent = history.slice(-MAX_HISTORY);
  const ask = mode === "briefing" ? `${BRIEFING}\n\nLo que dijo el usuario: «${question}»` : question;
  return [{ role: "user", content: context }, ...recent, { role: "user", content: ask }];
}

// Quita restos de formato que no se deben leer en voz alta.
export function cleanForSpeech(text) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Lectura local de titulares para cuando no hay cerebro disponible.
export function headlinesText(news, count = 3) {
  if (!news?.items?.length) return "Todavía no tengo noticias cargadas.";
  const top = [...news.items].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)).slice(0, count);
  return `Los titulares más importantes: ${top.map((n) => `${n.title}, según ${n.source}`).join(". ")}.`;
}

// Mensajes para cada código de error de sample().
export function errorMessage(code) {
  switch (code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return "No tengo permiso para usar mi cerebro en esta página. Actívalo en el menú de permisos de la app.";
    case "rate_limited":
      return "Estoy recibiendo demasiadas preguntas seguidas. Espera un momento y vuelve a preguntar.";
    case "session_expired":
      return "Tu sesión de Claude expiró. Vuelve a iniciar sesión y pregúntame de nuevo.";
    case "refused":
      return "Prefiero no responder a eso. Prueba a preguntarlo de otra forma.";
    default:
      return "Perdí la conexión con mi cerebro. Inténtalo de nuevo en un momento.";
  }
}

// Conecta con Claude a través de la app de Claude. Devuelve null si no está disponible
// (por ejemplo, al abrir index.html directamente en el navegador).
export async function createBrain() {
  if (!window.claude?.use) return null;
  const sample = await window.claude.use("sample");
  if (!sample) return null;

  const history = [];
  return {
    // onText recibe el texto completo a medida que llega.
    async ask(question, { mode, news, onText, signal } = {}) {
      const messages = buildMessages({ question, mode, history, news });
      try {
        const { text } = await sample(messages, {
          modelTier: pickTier(question, mode),
          cache: false,
          signal,
          onText: onText ? ({ text: t }) => onText(t) : undefined
        });
        history.push({ role: "user", content: question }, { role: "assistant", content: text });
        if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
        return cleanForSpeech(text);
      } catch (error) {
        if (error?.code === "cancelled") return error.text ? cleanForSpeech(error.text) : "";
        console.error("Error del cerebro:", error);
        return errorMessage(error?.code);
      }
    }
  };
}
