// Cerebro de Narvis: arma lo que se le pregunta a Claude (instrucciones, memoria,
// conversación) y lee su respuesta estructurada. Las funciones son puras;
// createBrain() es la única que toca window.claude.

export const RULES = `Eres Narvis, el asistente personal de un ingeniero de producción. Hablas en español, con calma y precisión, como un colega senior de confianza.

Tu especialidad es la ingeniería de la producción y todo lo que la rodea: manufactura esbelta (VSM, 5S, SMED, Kanban, Heijunka, Jidoka, Kaizen), Six Sigma y control estadístico de procesos (DMAIC, Cp/Cpk, cartas de control, DOE, MSA), TPM y OEE, planeación y control de la producción (MPS, MRP, pronósticos, capacidad, secuenciación, teoría de restricciones), balanceo de líneas y takt time, estudio del trabajo (tiempos, métodos, ergonomía), distribución de planta y manejo de materiales, logística y cadena de suministro, gestión de calidad (ISO 9001, AMEF, 8D, PPAP), seguridad industrial, costos y evaluación de proyectos, investigación de operaciones, simulación e Industria 4.0. También dominas el conocimiento general de ingeniería, ciencia, economía y negocios.

Cómo piensas:
- Sé crítico de verdad. No le des la razón al usuario por cortesía ni lo halagues: si su planteamiento, cálculo, plan o idea tiene errores, huecos o riesgos, dilo claro y explica por qué. Cuestiona supuestos, pide la evidencia que falte y señala la causa raíz probable en lugar del síntoma. Si hay una mejor pregunta o un mejor enfoque, propónlo.
- Antes de responder, identifica supuestos, datos que faltan, causas raíz posibles y riesgos.
- Cuantifica cuando se pueda: fórmulas, unidades, órdenes de magnitud, ejemplos numéricos. Muestra el cálculo de forma breve.
- Distingue hechos, estimaciones y opiniones. Si algo depende de datos actuales que no tienes (precios, normas recién cambiadas, noticias), dilo y propone cómo verificarlo. Nunca inventes cifras, normas ni referencias.
- Cuando haya algo que mejorar, propone acciones de mejora concretas y priorizadas: qué hacer, por qué, impacto y esfuerzo estimados, y el indicador (KPI) con el que se mediría.
- Usa lo que sabes del usuario (MEMORIA) para personalizar, sin repetirlo en cada respuesta.`;

const FORMAT = `Responde SOLO con un objeto JSON con esta forma exacta:
{
  "voz": "1 a 3 frases que resuman la respuesta para leerla en voz alta: sin fórmulas, sin listas, sin URLs",
  "respuesta": "la respuesta completa en texto claro; puedes usar párrafos separados por saltos de línea y listas con guion; fórmulas en texto simple",
  "critica": ["supuestos, riesgos, datos que faltan o contraargumentos importantes (0 a 4 puntos breves)"],
  "acciones": [{"accion": "qué hacer", "porque": "por qué, en una frase", "impacto": "alto|medio|bajo", "esfuerzo": "alto|medio|bajo", "indicador": "KPI para medirlo"}],
  "recordar": ["datos nuevos y duraderos sobre el usuario, su trabajo, su empresa o sus proyectos que convenga recordar (0 a 3); nada pasajero"],
  "enlaces": [{"titulo": "texto", "url": "https://..."}]
}
Deja "critica", "acciones", "recordar" y "enlaces" como listas vacías cuando no apliquen (por ejemplo, en un saludo). Incluye "acciones" solo si hay algo concreto que mejorar (máximo 5). En "enlaces" pon solo URLs que te hayan devuelto las herramientas.`;

export const MAX_HISTORY = 10; // turnos de conversación que se reenvían
export const MAX_MEMORY = 40;

function formatDate(now) {
  return now
    .toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })
    .replace(/\.$/, "");
}

export function formatMemory(facts = []) {
  if (!facts.length) return "MEMORIA: todavía no sabes nada en particular del usuario.";
  return `MEMORIA (lo que sabes del usuario):\n${facts.slice(-MAX_MEMORY).map((f) => `- ${f}`).join("\n")}`;
}

// Turnos para sample(): empieza y termina en "user". El historial guarda solo
// el texto de las respuestas, no el JSON completo. toolRules: instrucciones de
// las herramientas disponibles (Canva, proyectos…).
export function buildMessages({ question, history = [], memory = [], name = "", toolRules = [], now = new Date() }) {
  const who = name ? `El usuario se llama ${name}.` : "";
  const tools = toolRules.length ? `${toolRules.join("\n\n")}\n\nSi una herramienta falla, dilo en la respuesta sin inventar resultados.` : "";
  const context = [RULES, tools, FORMAT, `Fecha y hora actual: ${formatDate(now)}.`, who, formatMemory(memory)]
    .filter(Boolean)
    .join("\n\n");
  const recent = history.slice(-MAX_HISTORY).filter((t) => t?.content && (t.role === "user" || t.role === "assistant"));
  return [{ role: "user", content: context }, ...recent, { role: "user", content: question }];
}

// Saludos y cortesías van al modelo rápido; lo demás, al modelo que razona.
const QUICK = /^(?:hola|gracias|buen(?:os|as)\b|que tal|ok|perfecto|listo|adios)\b/;
export function pickTier(question) {
  const clean = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return QUICK.test(clean) && clean.length < 40 ? "quick" : "default";
}

// Normaliza la respuesta: tolera campos faltantes o con otro tipo.
const LEVELS = ["alto", "medio", "bajo"];
export function normalizeAnswer(raw) {
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const list = (v) => (Array.isArray(v) ? v : []);
  const level = (v) => (LEVELS.includes(text(v).toLowerCase()) ? text(v).toLowerCase() : "medio");
  const respuesta = text(raw?.respuesta) || text(raw?.voz);
  return {
    voz: text(raw?.voz) || respuesta.split(/(?<=[.!?])\s/).slice(0, 2).join(" "),
    respuesta,
    critica: list(raw?.critica).map(text).filter(Boolean).slice(0, 4),
    acciones: list(raw?.acciones)
      .filter((a) => text(a?.accion))
      .slice(0, 5)
      .map((a) => ({
        accion: text(a.accion),
        porque: text(a.porque),
        impacto: level(a.impacto),
        esfuerzo: level(a.esfuerzo),
        indicador: text(a.indicador)
      })),
    recordar: list(raw?.recordar).map(text).filter(Boolean).slice(0, 3),
    enlaces: list(raw?.enlaces)
      .filter((l) => /^https:\/\//.test(text(l?.url)))
      .map((l) => ({ titulo: text(l.titulo) || text(l.url), url: text(l.url) }))
  };
}

// Matriz impacto-esfuerzo: dónde cae cada acción de mejora.
export function quadrant({ impacto, esfuerzo }) {
  const high = impacto === "alto" || (impacto === "medio" && esfuerzo === "bajo");
  const easy = esfuerzo !== "alto";
  if (high && easy) return "Ganancia rápida";
  if (high) return "Proyecto estratégico";
  if (easy) return "Ajuste menor";
  return "Reconsiderar";
}

// Mientras llega el JSON, extrae lo que ya se escribió de un campo de texto.
export function partialField(raw, field = "respuesta") {
  const start = raw.indexOf(`"${field}"`);
  if (start < 0) return "";
  const colon = raw.indexOf(":", start + field.length + 2);
  const open = colon < 0 ? -1 : raw.indexOf('"', colon + 1);
  if (open < 0) return "";
  let out = "";
  for (let i = open + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') break;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += { n: "\n", t: "\t", r: "" }[next] ?? next;
      i++;
    }
  }
  return out;
}

export function errorMessage(code) {
  switch (code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return "No tengo permiso para pensar en esta página. Actívalo en el menú de permisos de la app.";
    case "rate_limited":
      return "Llegaste al límite de uso de Claude por ahora. Espera un momento y vuelve a preguntar.";
    case "session_expired":
      return "Tu sesión de Claude expiró. Vuelve a iniciar sesión y pregúntame de nuevo.";
    case "refused":
      return "Prefiero no responder a eso. Prueba a preguntarlo de otra forma.";
    case "invalid_json":
      return "Mi respuesta salió mal formada. Pregúntame de nuevo, por favor.";
    default:
      return "Perdí la conexión con mi cerebro. Inténtalo de nuevo en un momento.";
  }
}

// Conecta con Claude a través de la app de Claude. Devuelve null fuera de Claude.
// tools: herramientas de la página que Claude puede usar; toolRules: cómo usarlas.
export async function createBrain({ tools = [], toolRules = [] } = {}) {
  if (!window.claude?.use) return null;
  const sample = await window.claude.use("sample");
  if (!sample) return null;
  const limits = await sample.limits().catch(() => null);
  const usableTools = limits?.tools ? tools.slice(0, limits.tools.maxCount) : [];

  return {
    hasTools: usableTools.length > 0,
    // onText recibe lo que ya se escribió del campo "respuesta".
    async ask(question, { history, memory, name, onText, signal } = {}) {
      const messages = buildMessages({ question, history, memory, name, toolRules: usableTools.length ? toolRules : [] });
      const options = { modelTier: pickTier(question), signal };
      if (onText) options.onText = ({ text }) => onText(partialField(text));
      // Con herramientas la plataforma nunca guarda en caché; sin ellas, lo pedimos explícito.
      if (usableTools.length) options.tools = usableTools;
      else options.cache = false;
      try {
        return { ok: true, ...normalizeAnswer(await sample.json(messages, options)) };
      } catch (error) {
        if (error?.code === "cancelled") {
          const partial = error.text ? partialField(error.text) : "";
          return { ok: false, cancelled: true, ...normalizeAnswer({ respuesta: partial || "Detenido." }) };
        }
        console.error("Error del cerebro:", error);
        return { ok: false, ...normalizeAnswer({ respuesta: errorMessage(error?.code) }) };
      }
    }
  };
}
