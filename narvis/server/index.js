// Servidor local de Narvis: sirve la app en http://localhost (donde el navegador
// sí deja usar el micrófono) y conecta el cerebro de Claude, las noticias y Obsidian.
// Uso: npm run server  (lee la configuración de narvis/.env)
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVault } from "./vault.js";
import { createClaudeBrain, generateNews, MODEL } from "./claude.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const cacheDir = path.join(appRoot, ".cache");
const newsCacheFile = path.join(cacheDir, "news.json");

try {
  process.loadEnvFile(path.join(appRoot, ".env"));
} catch {
  /* sin .env: se usan las variables del entorno */
}

const PORT = Number(process.env.PORT) || 8000;
const HOST = "127.0.0.1"; // solo accesible desde esta computadora
const NEWS_MAX_AGE_MS = (Number(process.env.NEWS_MAX_AGE_HOURS) || 4) * 3600 * 1000;
const PUBLIC = ["index.html", "css/", "js/"]; // lo único que se sirve como archivo

async function openVault() {
  const root = process.env.OBSIDIAN_VAULT;
  if (!root) return null;
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) {
    console.warn(`OBSIDIAN_VAULT no es una carpeta: ${root}. Sigo sin Obsidian.`);
    return null;
  }
  return createVault({ root, folder: process.env.OBSIDIAN_FOLDER || "Narvis" });
}

const vault = await openVault();
const brain = createClaudeBrain({ vault });

// ---------- Noticias (caché en disco y en la bóveda) ----------
let news = JSON.parse(await fs.readFile(newsCacheFile, "utf8").catch(() => "null"));
let refreshing = null;

function newsIsStale() {
  return !news || Date.now() - new Date(news.updatedAt).getTime() > NEWS_MAX_AGE_MS;
}

function refreshNews() {
  refreshing ??= (async () => {
    console.log("Actualizando el radar de noticias…");
    try {
      news = await generateNews();
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(newsCacheFile, JSON.stringify(news, null, 2));
      if (vault) await vault.saveNews(news);
      console.log(`Radar actualizado: ${news.items.length} noticias.`);
    } catch (error) {
      console.error("No se pudo actualizar el radar:", error);
    } finally {
      refreshing = null;
    }
    return news;
  })();
  return refreshing;
}

// ---------- Utilidades HTTP ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

// Solo aceptamos peticiones de la propia app: JSON (obliga al navegador a pedir
// permiso CORS, que no damos) y, si viene, un Origin de este mismo servidor.
function isTrusted(req) {
  // Host fijo: evita que una página externa use DNS rebinding para hablarle al servidor.
  if (req.headers.host !== `localhost:${PORT}` && req.headers.host !== `${HOST}:${PORT}`) return false;
  const origin = req.headers.origin;
  if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://${HOST}:${PORT}`) return false;
  if (req.method === "POST" || req.method === "DELETE") {
    return (req.headers["content-type"] || "").startsWith("application/json");
  }
  return true;
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200_000) throw new Error("Petición demasiado grande");
  }
  return body ? JSON.parse(body) : {};
}

async function serveFile(res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath.slice(1));
  const file = path.resolve(appRoot, rel);
  const relative = path.relative(appRoot, file).split(path.sep).join("/");
  if (!PUBLIC.some((p) => relative === p || (p.endsWith("/") && relative.startsWith(p)))) {
    res.writeHead(404).end("No encontrado");
    return;
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}

// ---------- Rutas ----------
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith("/api/")) return serveFile(res, url.pathname);
  if (!isTrusted(req)) return sendJson(res, 403, { error: "Origen no permitido" });

  if (url.pathname === "/api/status" && req.method === "GET") {
    return sendJson(res, 200, { brain: true, model: MODEL, obsidian: vault ? vault.name : null });
  }

  if (url.pathname === "/api/news" && req.method === "GET") {
    if (url.searchParams.get("refresh") === "1") await refreshNews();
    else if (newsIsStale()) refreshNews(); // en segundo plano; se devuelve lo que haya
    return sendJson(res, 200, { news, refreshing: Boolean(refreshing) });
  }

  if (url.pathname === "/api/ask" && req.method === "POST") {
    const { question, mode, history } = await readJson(req);
    if (!question || typeof question !== "string") return sendJson(res, 400, { error: "Falta la pregunta" });
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    const text = await brain.ask({
      question: question.slice(0, 4000),
      mode,
      history: Array.isArray(history) ? history : [],
      news,
      signal: controller.signal,
      onText: (chunk) => res.write(chunk)
    });
    res.end();
    if (mode === "briefing" && vault && text.trim() && !controller.signal.aborted) {
      await vault.saveBriefing(text).catch((e) => console.error("No se guardó el resumen:", e));
    }
    return;
  }

  if (url.pathname === "/api/notes") {
    if (!vault) return sendJson(res, 404, { error: "Obsidian no está configurado" });
    if (req.method === "GET") return sendJson(res, 200, { notes: await vault.notes.list() });
    if (req.method === "POST") {
      const { text } = await readJson(req);
      if (!text || typeof text !== "string") return sendJson(res, 400, { error: "Falta el texto" });
      await vault.notes.add(text.slice(0, 2000));
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      await vault.notes.clear();
      return sendJson(res, 200, { ok: true });
    }
  }

  sendJson(res, 404, { error: "Ruta desconocida" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { error: "Error interno" });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Narvis listo en http://localhost:${PORT}`);
  console.log(`Cerebro: ${MODEL}`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("Aviso: falta ANTHROPIC_API_KEY en .env; el cerebro y el radar no funcionarán sin ella.");
  }
  console.log(vault ? `Obsidian: bóveda «${vault.name}»` : "Obsidian: sin configurar (define OBSIDIAN_VAULT en .env)");
  if (newsIsStale()) refreshNews();
});
