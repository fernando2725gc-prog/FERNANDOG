// Cerebro de Narvis en el servidor local: Claude con búsqueda web y acceso a la
// bóveda de Obsidian, y el generador del radar de noticias.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { RULES, TOPICS, formatNews, pickTier } from "../js/brain.js";

export const MODEL = process.env.NARVIS_MODEL || "claude-opus-5-5";

// Si los filtros de seguridad rechazan una petición, la API la reintenta en el
// modelo de respaldo que recomienda Anthropic para ese tipo de rechazo.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
const WEB_SEARCH = { type: "web_search_20260209", name: "web_search" };
const MAX_HISTORY = 8;

const TOOL_RULES = `Herramientas:
- web_search: úsala para datos de actualidad que no estén en las NOTICIAS RECIENTES o que puedan haber cambiado (precios, resultados, clima, sucesos de hoy). Una o dos búsquedas bastan.
- Es una conversación por voz y la latencia importa: empieza tu respuesta visible de inmediato y no anuncies lo que vas a hacer.`;

const OBSIDIAN_RULES = `Obsidian: tienes acceso a la bóveda personal del usuario (sus notas en Markdown).
- Búscala cuando pregunte por sus notas, proyectos, ideas, pendientes o "lo que tengo anotado". Lee la nota antes de citarla; nunca inventes su contenido.
- Cuando pida guardar, apuntar o crear algo en Obsidian, usa crear_nota_obsidian con contenido en Markdown bien organizado (títulos, listas, fecha). Para añadir a una nota que ya existe, usa agregar_a_nota_obsidian.
- Al responder en voz, di solo el nombre de la nota, no la ruta completa.`;

// Las entradas de estas herramientas son cortas, así que no se transmiten por
// partes (sin eager_input_streaming): la API las valida completas antes de usarlas.
function obsidianTools(vault) {
  return [
    betaZodTool({
      name: "buscar_en_obsidian",
      description: "Busca notas en la bóveda de Obsidian del usuario por palabras clave en el título y el contenido. Devuelve hasta 8 notas con su ruta y un extracto.",
      inputSchema: z.object({ consulta: z.string().describe("Palabras clave a buscar") }),
      run: async ({ consulta }) => JSON.stringify(await vault.search(consulta))
    }),
    betaZodTool({
      name: "leer_nota_obsidian",
      description: "Lee el contenido completo de una nota de la bóveda. Usa la ruta que devolvió buscar_en_obsidian o notas_recientes_obsidian.",
      inputSchema: z.object({ ruta: z.string().describe("Ruta de la nota dentro de la bóveda, por ejemplo Proyectos/Casa.md") }),
      run: async ({ ruta }) => vault.read(ruta)
    }),
    betaZodTool({
      name: "notas_recientes_obsidian",
      description: "Lista las 10 notas modificadas más recientemente en la bóveda, con su ruta y fecha.",
      inputSchema: z.object({}),
      run: async () => JSON.stringify(await vault.listRecent())
    }),
    betaZodTool({
      name: "crear_nota_obsidian",
      description: "Crea una nota nueva en la carpeta de Narvis dentro de la bóveda. Si ya existe una con ese título, agrega el contenido al final con la fecha. Devuelve la ruta.",
      inputSchema: z.object({
        titulo: z.string().describe("Título corto de la nota, sin extensión"),
        contenido: z.string().describe("Contenido en Markdown")
      }),
      run: async ({ titulo, contenido }) => JSON.stringify(await vault.createNote(titulo, contenido))
    }),
    betaZodTool({
      name: "agregar_a_nota_obsidian",
      description: "Agrega texto al final de una nota que ya existe en la bóveda, sin borrar nada. Devuelve la ruta.",
      inputSchema: z.object({
        ruta: z.string().describe("Ruta de la nota existente dentro de la bóveda"),
        texto: z.string().describe("Texto en Markdown que se agrega al final")
      }),
      run: async ({ ruta, texto }) => JSON.stringify(await vault.appendToNote(ruta, texto))
    })
  ];
}

function formatDate(now) {
  return now.toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit"
  });
}

const BRIEFING = "Dame el resumen del día: las 4 o 5 noticias más importantes de las NOTICIAS RECIENTES, empezando por la de mayor impacto. Para cada una, una frase con lo que pasó y otra con por qué importa. Al final, una frase sobre qué vigilar. Menos de 180 palabras, en texto corrido para leer en voz alta.";

// Arma la petición. Las instrucciones fijas van en `system` (se guardan en caché);
// la fecha y las noticias, que cambian, van en el último mensaje.
export function buildRequest({ question, mode, history = [], news, vault, now = new Date() }) {
  const system = [RULES, TOOL_RULES, vault ? OBSIDIAN_RULES : ""].filter(Boolean).join("\n\n");
  const ask = mode === "briefing" ? `${BRIEFING}\n\nLo que dijo el usuario: «${question}»` : question;
  const context = `Fecha y hora actual: ${formatDate(now).replace(/\.$/, "")}.\n\n${formatNews(news)}`;
  const recent = history.slice(-MAX_HISTORY).filter((t) => t?.content && (t.role === "user" || t.role === "assistant"));
  if (recent[0]?.role === "assistant") recent.shift();
  return {
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    // Preguntas rápidas: esfuerzo bajo para responder pronto. Análisis y resúmenes: medio.
    output_config: { effort: pickTier(question, mode) === "quick" ? "low" : "medium" },
    tools: [{ ...WEB_SEARCH, max_uses: 3 }, ...(vault ? obsidianTools(vault) : [])],
    messages: [
      ...recent.map((t) => ({ role: t.role, content: String(t.content) })),
      { role: "user", content: `${context}\n\n${ask}` }
    ],
    max_iterations: 8,
    ...FALLBACK
  };
}

export function friendlyError(error) {
  if (!(error instanceof Anthropic.APIError) && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return "No encontré la clave de la API de Claude. Agrega ANTHROPIC_API_KEY al archivo .env y reinicia el servidor.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "No tengo una clave de API válida. Revisa ANTHROPIC_API_KEY en el archivo .env del servidor.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "Tu clave de API no tiene permiso para este modelo o función.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Llegué al límite de uso de la API. Espera un momento y vuelve a preguntar.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "No pude conectarme con Claude. Revisa tu conexión a internet.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude respondió con un error (${error.status}). Inténtalo de nuevo en un momento.`;
  }
  return "Tuve un problema al pensar la respuesta. Inténtalo de nuevo.";
}

export function createClaudeBrain({ client = new Anthropic(), vault = null } = {}) {
  return {
    // Escribe la respuesta por partes con onText(delta) y devuelve el texto completo.
    async ask({ question, mode, history, news, onText = () => {}, signal }) {
      const params = buildRequest({ question, mode, history, news, vault });
      const runner = client.beta.messages.toolRunner({ ...params, stream: true }, { signal });
      let text = "";
      const write = (chunk) => {
        text += chunk;
        onText(chunk);
      };

      try {
        for await (const messageStream of runner) {
          if (text && !text.endsWith("\n")) write("\n\n");
          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") write(event.delta.text);
          }
          const message = await messageStream.finalMessage();
          // Una herramienta cortada por max_tokens o un rechazo a media respuesta no se ejecutan.
          const hasToolUse = message.content.some((b) => b.type === "tool_use");
          if (message.stop_reason === "max_tokens" && hasToolUse) {
            write("Mi respuesta se cortó antes de terminar. Pídemelo de forma más concreta.");
            return text;
          }
          if (message.stop_reason === "refusal") {
            if (!text.trim()) write("Prefiero no responder a eso. Prueba a preguntarlo de otra forma.");
            return text;
          }
        }
        return text;
      } catch (error) {
        if (signal?.aborted) return text;
        console.error("Error del cerebro:", error);
        if (text) write("\n\n");
        write(friendlyError(error));
        return text;
      }
    }
  };
}

// ---------- Radar de noticias ----------
const NewsSchema = z.object({
  items: z.array(
    z.object({
      topic: z.enum(TOPICS),
      importance: z.number().describe("3 = alto impacto, 2 = importante, 1 = a seguir"),
      title: z.string(),
      summary: z.string(),
      source: z.string(),
      url: z.string(),
      date: z.string()
    })
  )
});

function researchPrompt(now) {
  return `Hoy es ${formatDate(now).replace(/\.$/, "")}. Busca en la web las noticias más importantes de las últimas 24 horas en estos temas: ${TOPICS.join(", ")}. En Geopolítica incluye conflictos, elecciones y diplomacia; en Economía, mercados, bancos centrales, petróleo y tipo de cambio; en México, política, seguridad, economía y desastres naturales. Prioriza lo de mayor impacto mundial y para México; ignora espectáculos y deportes salvo que sean de enorme relevancia.

Haz varias búsquedas y escribe un informe con entre 15 y 25 noticias. Para cada una: tema, titular, una o dos frases con lo que pasó y por qué importa, el nombre del medio, la URL exacta de la nota y su fecha. Usa solo hechos de los resultados; si las fuentes difieren, dilo. Todo en español.`;
}

export async function generateNews({ client = new Anthropic(), now = new Date() } = {}) {
  // 1) Investigación con búsqueda web.
  const research = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    tools: [{ ...WEB_SEARCH, max_uses: 10 }],
    messages: [{ role: "user", content: researchPrompt(now) }],
    max_iterations: 6,
    ...FALLBACK
  });
  if (research.stop_reason === "refusal") throw new Error("La investigación de noticias fue rechazada.");
  const report = research.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (!report.trim()) throw new Error("La investigación de noticias no devolvió texto.");

  // 2) Convertir el informe en la lista estructurada del radar.
  const parsed = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(NewsSchema) },
    messages: [{
      role: "user",
      content: `Convierte este informe de noticias en la lista estructurada. Conserva los datos tal cual, sin agregar nada. Marca con importance 3 solo las 3 a 5 de mayor impacto.\n\n${report}`
    }]
  });
  if (parsed.stop_reason === "refusal" || !parsed.parsed_output) throw new Error("No se pudo estructurar el radar de noticias.");

  return {
    updatedAt: now.toISOString(),
    items: parsed.parsed_output.items.map((n, i) => ({
      ...n,
      id: `n${i + 1}`,
      importance: Math.min(3, Math.max(1, Math.round(n.importance) || 1))
    }))
  };
}
