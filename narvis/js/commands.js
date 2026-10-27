// Comandos rápidos de Narvis: interpreta frases en español y decide qué responder.
// Lo que no coincide con ningún comando lo contesta el cerebro (brain.js).
// No toca el DOM ni las APIs de voz, así se puede probar con Node.

export const WAKE_WORD = "narvis";

// Minúsculas, sin acentos ni signos, espacios simples.
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!,;:"]/g, " ")
    .replace(/\.(?!\w)/g, " ") // conserva el punto de "google.com" o "2.5"
    .replace(/\s+/g, " ")
    .trim();
}

// Separa la palabra de activación. Devuelve null si la frase no empieza con ella.
export function stripWakeWord(text) {
  const clean = normalize(text);
  const match = clean.match(/^(?:oye |hey |ok )?(?:narvis|narvi|narbis|marvis|nervis|narvez|jarvis)\b\s*(.*)$/);
  return match ? match[1] : null;
}

const SITES = {
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  gmail: "https://mail.google.com",
  correo: "https://mail.google.com",
  whatsapp: "https://web.whatsapp.com",
  facebook: "https://www.facebook.com",
  instagram: "https://www.instagram.com",
  twitter: "https://x.com",
  x: "https://x.com",
  netflix: "https://www.netflix.com",
  spotify: "https://open.spotify.com",
  github: "https://github.com",
  maps: "https://www.google.com/maps",
  mapas: "https://www.google.com/maps",
  wikipedia: "https://es.wikipedia.org",
  amazon: "https://www.amazon.com.mx",
  chatgpt: "https://chatgpt.com",
  claude: "https://claude.ai"
};

const JOKES = [
  "¿Por qué los programadores confunden Halloween con Navidad? Porque 31 octal es igual a 25 decimal.",
  "Le pregunté a mi computadora por un chiste de UDP, pero no sé si lo recibió.",
  "¿Qué le dice un bit al otro? Nos vemos en el bus.",
  "Hay 10 tipos de personas: las que entienden binario y las que no.",
  "¿Cuál es el café más peligroso del mundo? El ex-preso."
];

const NUMBER_WORDS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, cien: 100, mil: 1000, medio: 0.5, media: 0.5
};

function toNumber(word) {
  if (word in NUMBER_WORDS) return NUMBER_WORDS[word];
  const n = Number(word.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const OPERATORS = [
  [/\s*(?:mas|\+)\s*/g, " + "],
  [/\s*(?:menos|-)\s*/g, " - "],
  [/\s*(?:dividido entre|dividido por|entre|\/|÷)\s*/g, " / "],
  [/\s*(?:multiplicado por|por|x|\*|×)\s*/g, " * "],
  [/\s*(?:elevado a la|elevado a|a la potencia)\s*/g, " ^ "]
];

// Evalúa "5 mas 3 por 2" respetando precedencia. Devuelve null si no es una cuenta.
export function calculate(expression) {
  let expr = ` ${expression} `;
  for (const [pattern, symbol] of OPERATORS) expr = expr.replace(pattern, symbol);
  const tokens = expr.trim().split(/\s+/);
  if (tokens.length < 3 || tokens.length % 2 === 0) return null;

  const values = [];
  const ops = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      const n = toNumber(tokens[i]);
      if (n === null) return null;
      values.push(n);
    } else {
      if (!"+-*/^".includes(tokens[i]) || tokens[i].length !== 1) return null;
      ops.push(tokens[i]);
    }
  }

  // Precedencia: ^, luego * /, luego + -.
  const reduce = (allowed, fn) => {
    for (let i = 0; i < ops.length; ) {
      if (allowed.includes(ops[i])) {
        values.splice(i, 2, fn(ops[i], values[i], values[i + 1]));
        ops.splice(i, 1);
      } else {
        i++;
      }
    }
  };
  reduce("^", (_, a, b) => a ** b);
  reduce("*/", (op, a, b) => (op === "*" ? a * b : a / b));
  reduce("+-", (op, a, b) => (op === "+" ? a + b : a - b));

  const result = values[0];
  if (!Number.isFinite(result)) return null;
  return Math.round(result * 1e6) / 1e6;
}

function formatNumber(n) {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 6 });
}

const UNIT_SECONDS = { segundo: 1, minuto: 60, hora: 3600 };

// "5 minutos", "un minuto y medio", "media hora" -> segundos
export function parseDuration(text) {
  if (/^media hora$/.test(text)) return 1800;
  const match = text.match(/^(\S+) (segundo|minuto|hora)s?( y medio| y media)?$/);
  if (!match) return null;
  const amount = toNumber(match[1]);
  if (amount === null || amount <= 0) return null;
  const unit = UNIT_SECONDS[match[2]];
  return Math.round((amount + (match[3] ? 0.5 : 0)) * unit);
}

function describeDuration(seconds) {
  if (seconds % 3600 === 0) return plural(seconds / 3600, "hora");
  if (seconds % 60 === 0) return plural(seconds / 60, "minuto");
  if (seconds > 60) return `${plural(Math.floor(seconds / 60), "minuto")} y ${plural(seconds % 60, "segundo")}`;
  return plural(seconds, "segundo");
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function titleCase(text) {
  return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

// Cada comando: patrones (sobre texto normalizado) y run(match, ctx).
// run devuelve un string, o una promesa de string, con lo que Jarvis dirá.
// ctx: { now(), openUrl(url, label), notes, startTimer(seconds, label), fetchJson(url),
//        briefing(phrase), stop(), canFetch }  — notes.add/list/clear pueden ser async.
export const COMMANDS = [
  {
    name: "saludo",
    help: "Hola Jarvis",
    patterns: [/^(?:hola|buenos dias|buenas tardes|buenas noches|que tal|como estas)\b/],
    run: (_, ctx) => {
      const hour = ctx.now().getHours();
      const part = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
      return `${part}. Todos los sistemas funcionando. ¿En qué puedo ayudarte?`;
    }
  },
  {
    name: "hora",
    help: "¿Qué hora es?",
    patterns: [/\bque hora es\b/, /^(?:dime )?la hora$/],
    run: (_, ctx) => {
      const time = ctx.now().toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
      return `Son las ${time}`.replace(/\.?$/, ".");
    }
  },
  {
    name: "fecha",
    help: "¿Qué día es hoy?",
    patterns: [/\bque (?:dia|fecha) es\b/, /^(?:dime )?la fecha$/, /\bque dia es hoy\b/],
    run: (_, ctx) => {
      const date = ctx.now().toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      });
      return `Hoy es ${date}.`;
    }
  },
  {
    name: "calcular",
    help: "¿Cuánto es 25 por 4?",
    patterns: [/^(?:cuanto es|cuanto son|calcula|calcular|resuelve) (.+)$/],
    run: ([, expr]) => {
      const result = calculate(expr);
      return result === null
        ? "No pude entender esa operación. Prueba algo como: cuánto es 12 por 8."
        : `El resultado es ${formatNumber(result)}.`;
    }
  },
  {
    name: "temporizador",
    help: "Pon un temporizador de 5 minutos",
    patterns: [
      /^(?:pon|ponme|inicia|crea|activa)(?: un)? (?:temporizador|timer|alarma|cronometro) (?:de|por|para) (.+)$/,
      /^avisame en (.+)$/,
      /^recuerdame en (.+)$/
    ],
    run: ([, amount], ctx) => {
      const seconds = parseDuration(amount);
      if (!seconds) return "No entendí la duración. Di por ejemplo: pon un temporizador de 5 minutos.";
      const label = describeDuration(seconds);
      ctx.startTimer(seconds, label);
      return `Temporizador de ${label} en marcha. Te aviso cuando termine.`;
    }
  },
  {
    name: "anotar",
    help: "Anota comprar leche",
    patterns: [/^(?:anota|apunta|toma nota|recuerda|guarda la nota|agrega la nota)(?: de| que)? (.+)$/],
    run: async ([, clean], ctx, original) => {
      const note = originalTail(original, clean);
      await ctx.notes.add(note);
      return `Anotado: ${note}.`;
    }
  },
  {
    name: "leer notas",
    help: "Lee mis notas",
    patterns: [/^(?:lee|leer|dime|muestra|cuales son) (?:mis |las )?notas$/, /^que tengo anotado$/],
    run: async (_, ctx) => {
      const notes = await ctx.notes.list();
      if (notes.length === 0) return "No tienes notas guardadas.";
      const items = notes.map((n, i) => `${i + 1}: ${n}`).join(". ");
      return `Tienes ${plural(notes.length, "nota")}. ${items}.`;
    }
  },
  {
    name: "borrar notas",
    help: "Borra mis notas",
    patterns: [/^(?:borra|borrar|elimina|limpia) (?:todas )?(?:mis |las )?notas$/],
    run: async (_, ctx) => {
      await ctx.notes.clear();
      return "Listo, tu lista de notas quedó vacía.";
    }
  },
  {
    name: "noticias",
    help: "¿Qué está pasando en el mundo?",
    patterns: [
      /\b(?:noticias|titulares|resumen del dia|resumen de hoy|informe del dia)\b/,
      /\bque (?:esta pasando|pasa|hay de nuevo) en (?:el mundo|mexico|la economia)\b/
    ],
    run: ([phrase], ctx) => ctx.briefing(phrase)
  },
  {
    name: "youtube",
    help: "Pon música relajante en YouTube",
    patterns: [
      /^(?:pon|reproduce|busca|ponme) (.+) en youtube$/,
      /^(?:reproduce|ponme) (.+)$/
    ],
    run: ([, query], ctx) => {
      ctx.openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, `YouTube: ${query}`);
      return `Buscando ${query} en YouTube.`;
    }
  },
  {
    name: "abrir",
    help: "Abre YouTube",
    patterns: [/^(?:abre|abrir|abreme|entra a|ve a|llevame a) (?:el |la )?(.+)$/],
    run: ([, site], ctx) => {
      const key = site.replace(/\s+/g, "");
      const url = SITES[key] ?? SITES[site];
      if (url) {
        ctx.openUrl(url, titleCase(site));
        return `Abriendo ${site}.`;
      }
      if (/^[a-z0-9-]+(?:\.[a-z]{2,})+$/.test(key)) {
        ctx.openUrl(`https://${key}`, key);
        return `Abriendo ${key}.`;
      }
      ctx.openUrl(`https://www.google.com/search?q=${encodeURIComponent(site)}`, `Google: ${site}`);
      return `No conozco ${site}, así que lo busqué en Google.`;
    }
  },
  {
    name: "buscar",
    help: "Busca recetas de pasta",
    patterns: [/^(?:busca|buscar|googlea|investiga)(?: en google)? (.+?)(?: en google)?$/],
    run: ([, query], ctx) => {
      ctx.openUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`, `Google: ${query}`);
      return `Buscando ${query} en Google.`;
    }
  },
  {
    name: "clima",
    network: true,
    help: "¿Cómo está el clima en Monterrey?",
    patterns: [/\b(?:clima|tiempo|temperatura)(?: hace| hay)? en (.+)$/],
    run: async ([, city], ctx) => {
      const geo = await ctx.fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`
      );
      const place = geo.results?.[0];
      if (!place) return `No encontré la ciudad ${city}.`;
      const data = await ctx.fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto"
      );
      const c = data.current;
      return (
        `En ${place.name} hay ${Math.round(c.temperature_2m)} grados, ${describeWeather(c.weather_code)}, ` +
        `con sensación térmica de ${Math.round(c.apparent_temperature)} y humedad del ${c.relative_humidity_2m} por ciento.`
      );
    }
  },
  {
    name: "wikipedia",
    network: true,
    help: "¿Quién es Marie Curie?",
    patterns: [
      /^(?:quien es|quien era|quien fue|que es|que era|que son|que fue|hablame de|hablame sobre|informacion sobre|dime sobre) (?:el |la |los |las |un |una )?(.+)$/
    ],
    run: async ([, topic], ctx) => {
      const data = await ctx.fetchJson(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/ /g, "_"))}`
      );
      if (!data.extract || data.type === "disambiguation") {
        ctx.openUrl(`https://www.google.com/search?q=${encodeURIComponent(topic)}`, `Google: ${topic}`);
        return `No encontré un resumen claro sobre ${topic}. Te dejo una búsqueda en Google.`;
      }
      return firstSentences(data.extract, 2);
    }
  },
  {
    name: "chiste",
    help: "Cuéntame un chiste",
    patterns: [/\bchiste\b/],
    run: () => JOKES[Math.floor(Math.random() * JOKES.length)]
  },
  {
    name: "identidad",
    help: "¿Quién eres?",
    patterns: [/^(?:quien eres|como te llamas|que eres)$/],
    run: () => "Soy Narvis, tu asistente personal por voz, enfocado en los temas que importan. Di ayuda para ver lo que puedo hacer."
  },
  {
    name: "gracias",
    help: "Gracias",
    patterns: [/^(?:gracias|muchas gracias|te lo agradezco)\b/],
    run: () => "Para eso estoy."
  },
  {
    name: "ayuda",
    help: "Ayuda",
    patterns: [/^(?:ayuda|que puedes hacer|que sabes hacer|comandos)$/],
    run: () =>
      "Puedo darte el resumen de noticias del día, explicarte temas de política, economía, " +
      "ciencia y salud, decirte la hora y la fecha, hacer cuentas, poner temporizadores, " +
      "guardar notas, abrir páginas y buscar en Google y YouTube."
  },
  {
    name: "apagar",
    help: "Apágate",
    patterns: [/^(?:apagate|duerme|descansa|adios|hasta luego|deja de escuchar|desactivate)$/],
    run: (_, ctx) => {
      ctx.stop();
      return "Entendido. Desactivando la escucha. Hasta luego.";
    }
  }
];

// Recupera del texto original (con acentos y mayúsculas) las últimas palabras que
// corresponden a `part`, que viene normalizado. "Anota llamar a Mamá" -> "llamar a Mamá".
export function originalTail(original, part) {
  const count = part.split(" ").length;
  const words = original.trim().split(/\s+/).filter((w) => normalize(w));
  if (words.length < count) return part;
  return words.slice(-count).join(" ").replace(/[.,;:!?¡¿"]+$/, "");
}

function firstSentences(text, count) {
  const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return parts.slice(0, count).join("").trim();
}

function describeWeather(code) {
  if (code === 0) return "despejado";
  if (code <= 2) return "parcialmente nublado";
  if (code === 3) return "nublado";
  if (code <= 48) return "con niebla";
  if (code <= 57) return "con llovizna";
  if (code <= 67) return "con lluvia";
  if (code <= 77) return "con nieve";
  if (code <= 82) return "con chubascos";
  if (code <= 86) return "con nevadas";
  return "con tormenta";
}

// Busca el primer comando que coincida. Devuelve { command, match } o null.
// Con canFetch: false se saltan los comandos que necesitan internet desde la página.
export function matchCommand(text, { canFetch = true } = {}) {
  const clean = stripWakeWord(text) ?? normalize(text);
  if (!clean) return null;
  for (const command of COMMANDS) {
    if (command.network && !canFetch) continue;
    for (const pattern of command.patterns) {
      const match = clean.match(pattern);
      if (match) return { command, match };
    }
  }
  return null;
}

// Punto de entrada: frase -> respuesta hablada, o null si ningún comando aplica
// (entonces la pregunta pasa al cerebro).
export async function respond(text, ctx) {
  const found = matchCommand(text, { canFetch: ctx.canFetch !== false });
  if (!found) return null;
  try {
    return await found.command.run(found.match, ctx, text);
  } catch (error) {
    console.error(`Error en el comando ${found.command.name}:`, error);
    return "Tuve un problema al hacer eso. Revisa tu conexión e inténtalo de nuevo.";
  }
}
