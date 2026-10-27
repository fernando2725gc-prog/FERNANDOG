// Herramientas de Canva para el cerebro: llaman al conector de Canva de la cuenta
// del usuario a través de la app de Claude. Claude decide cuándo usarlas.

const SERVER = "Canva";
const POLL_LIMIT_MS = 120000; // la plataforma corta cada herramienta a los 150 s

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new Error("cancelado"));
    });
  });

// Mensaje útil para Claude cuando el conector falla.
function describeError(error) {
  switch (error?.code) {
    case "server_not_connected":
    case "needs_reauth":
      return "Canva no está conectado. Pide al usuario que lo conecte en claude.ai › Configuración › Conectores.";
    case "not_in_manifest":
      return "El usuario no dio permiso a esta app para usar Canva.";
    default:
      return `Canva no respondió (${error?.code ?? "error"}): ${error?.message ?? ""}`.trim();
  }
}

// Resume el resultado de búsqueda: solo lo que Claude necesita para responder.
export function summarizeDesigns(payload) {
  return (payload?.items ?? []).map((d) => ({
    titulo: d.title || "Sin título",
    tipo: (d.design_types ?? []).join(", "),
    paginas: d.page_count,
    modificado: d.updated_at ? new Date(d.updated_at * 1000).toISOString().slice(0, 10) : undefined,
    url: d.urls?.edit_url ?? d.urls?.view_url
  }));
}

export function createCanvaTools(mcp, { onActivity = () => {} } = {}) {
  return [
    {
      name: "canva_buscar_disenos",
      description:
        "Busca diseños en la cuenta de Canva del usuario (presentaciones, documentos, infografías). Devuelve título, tipo, fecha y enlace de cada uno. Sin consulta, devuelve los más recientes.",
      inputSchema: {
        type: "object",
        properties: { consulta: { type: "string", description: "Palabras del título o contenido; vacío para los más recientes" } },
        additionalProperties: false
      },
      async execute(input, { signal }) {
        onActivity("Buscando en tu Canva…");
        const query = String(input.consulta ?? "").trim();
        try {
          const result = await mcp.callTool(
            SERVER,
            "search-designs",
            {
              ...(query ? { query, sort_by: "relevance" } : { sort_by: "modified_descending" }),
              limit: 8,
              user_intent: "Narvis busca diseños del usuario para responder su pregunta"
            },
            { signal }
          );
          return summarizeDesigns(result.payload);
        } catch (error) {
          throw new Error(describeError(error));
        }
      }
    },
    {
      name: "canva_crear_diseno",
      description:
        "Crea un diseño nuevo en la cuenta de Canva del usuario a partir de un brief (presentación, documento, infografía, póster, reporte…). Tarda hasta dos minutos y devuelve el resultado con el enlace al diseño. Úsala solo si el usuario lo pide.",
      inputSchema: {
        type: "object",
        properties: {
          brief: { type: "string", description: "Qué crear: tema, propósito, contenido completo, tono y estilo" },
          formato: { type: "string", description: "Opcional: formato de Canva, por ejemplo «Presentation», «Doc», «Infographic»" }
        },
        required: ["brief"],
        additionalProperties: false
      },
      async execute(input, { signal }) {
        onActivity("Creando el diseño en Canva…");
        try {
          const started = await mcp.callTool(SERVER, "create-design", {
            brief: String(input.brief),
            ...(input.formato ? { format: String(input.formato) } : {}),
            user_intent: "Narvis crea un diseño que el usuario pidió"
          });
          let job = started.payload ?? {};
          const deadline = Date.now() + POLL_LIMIT_MS;
          // Consulta el trabajo cada vez que Canva lo indique, hasta que tenga el diseño.
          const finished = (j) => Boolean(j.design) || /complete|success|fail|error/i.test(String(j.status ?? ""));
          while (job.job_id && job.continuation_token && job.polling_policy && !finished(job) && Date.now() < deadline) {
            await wait(Math.max(2, Number(job.polling_policy.wait_seconds) || 5) * 1000, signal);
            onActivity("Canva sigue preparando el diseño…");
            const next = await mcp.callTool(SERVER, "get-create-design-async-job", {
              job_id: job.job_id,
              continuation_token: job.continuation_token,
              user_intent: "Narvis espera el diseño que el usuario pidió"
            });
            job = { job_id: job.job_id, ...(next.payload ?? {}) };
          }
          return job;
        } catch (error) {
          if (signal?.aborted) throw new Error("El usuario detuvo la creación.");
          throw new Error(describeError(error));
        }
      }
    }
  ];
}

export const CANVA_MANIFEST = { server: SERVER, tools: ["search-designs", "create-design", "get-create-design-async-job"] };
