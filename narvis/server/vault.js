// Acceso a la bóveda de Obsidian: son archivos Markdown en una carpeta, así que
// se leen y escriben directo con el sistema de archivos. Narvis escribe solo
// dentro de su carpeta (por defecto "Narvis/") salvo para agregar texto al final
// de una nota existente; nunca borra ni reemplaza notas del usuario.
import fs from "node:fs/promises";
import path from "node:path";

const MAX_READ_CHARS = 20000;
const MAX_FILES_SCANNED = 5000;
const IGNORED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

export function dateStamp(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeStamp(now = new Date()) {
  return now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// Quita caracteres que no se permiten en nombres de archivo de Obsidian.
export function safeTitle(title) {
  const clean = String(title).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  return clean.slice(0, 120) || "Nota de Narvis";
}

export function createVault({ root, folder = "Narvis", now = () => new Date() }) {
  const base = path.resolve(root);
  const ownDir = path.join(base, folder);
  const notesFile = path.join(ownDir, "Notas.md");

  // Convierte una ruta relativa a la bóveda en absoluta, rechazando lo que salga de ella.
  async function resolve(relPath, { mustExist = true } = {}) {
    let rel = String(relPath).trim().replace(/^\/+/, "");
    if (!rel.toLowerCase().endsWith(".md")) rel += ".md";
    const target = path.resolve(base, rel);
    const relative = path.relative(base, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("La ruta sale de la bóveda.");
    if (mustExist) {
      const real = await fs.realpath(target);
      const realBase = await fs.realpath(base);
      const realRel = path.relative(realBase, real);
      if (realRel.startsWith("..") || path.isAbsolute(realRel)) throw new Error("La ruta sale de la bóveda.");
    }
    return target;
  }

  async function* walk(dir, counter = { n: 0 }) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (counter.n >= MAX_FILES_SCANNED) return;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name), counter);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        counter.n++;
        yield path.join(dir, entry.name);
      }
    }
  }

  const rel = (abs) => path.relative(base, abs).split(path.sep).join("/");

  async function appendText(file, text) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    let prefix = "";
    try {
      const current = await fs.readFile(file, "utf8");
      if (current && !current.endsWith("\n")) prefix = "\n";
    } catch {
      /* archivo nuevo */
    }
    await fs.appendFile(file, `${prefix}${text}\n`, "utf8");
  }

  return {
    name: path.basename(base),

    // Busca palabras en títulos y contenido. Devuelve las notas más relevantes con un extracto.
    async search(query, limit = 8) {
      const terms = String(query).toLowerCase().split(/\s+/).filter((t) => t.length > 1);
      if (terms.length === 0) return [];
      const results = [];
      for await (const file of walk(base)) {
        const content = await fs.readFile(file, "utf8").catch(() => "");
        const haystack = `${path.basename(file, ".md")}\n${content}`.toLowerCase();
        const score = terms.reduce((sum, t) => sum + (haystack.includes(t) ? 1 : 0), 0);
        if (score === 0) continue;
        const lower = content.toLowerCase();
        const at = Math.max(0, lower.indexOf(terms.find((t) => lower.includes(t)) ?? ""));
        const excerpt = content.slice(Math.max(0, at - 120), at + 240).replace(/\s+/g, " ").trim();
        results.push({ ruta: rel(file), coincidencias: score, extracto: excerpt });
      }
      return results.sort((a, b) => b.coincidencias - a.coincidencias).slice(0, limit);
    },

    async read(relPath) {
      const file = await resolve(relPath);
      const content = await fs.readFile(file, "utf8");
      return content.length > MAX_READ_CHARS ? `${content.slice(0, MAX_READ_CHARS)}\n[…nota recortada]` : content;
    },

    // Crea una nota en la carpeta de Narvis; si ya existe, agrega el contenido al final.
    async createNote(title, content) {
      const file = path.join(ownDir, `${safeTitle(title)}.md`);
      const exists = await fs.access(file).then(() => true, () => false);
      if (exists) {
        await appendText(file, `\n## ${dateStamp(now())} ${timeStamp(now())}\n\n${content}`);
      } else {
        await fs.mkdir(ownDir, { recursive: true });
        await fs.writeFile(file, `${content}\n`, "utf8");
      }
      return { ruta: rel(file), nueva: !exists };
    },

    // Agrega texto al final de una nota existente de cualquier parte de la bóveda.
    async appendToNote(relPath, text) {
      const file = await resolve(relPath);
      await appendText(file, `\n${text}`);
      return { ruta: rel(file) };
    },

    async listRecent(limit = 10) {
      const files = [];
      for await (const file of walk(base)) {
        const stat = await fs.stat(file).catch(() => null);
        if (stat) files.push({ ruta: rel(file), modificada: stat.mtime.toISOString() });
      }
      return files.sort((a, b) => b.modificada.localeCompare(a.modificada)).slice(0, limit);
    },

    // Notas rápidas: una lista de tareas en Narvis/Notas.md.
    notes: {
      async add(text) {
        const exists = await fs.access(notesFile).then(() => true, () => false);
        if (!exists) {
          await fs.mkdir(ownDir, { recursive: true });
          await fs.writeFile(notesFile, "# Notas de Narvis\n\n", "utf8");
        }
        await appendText(notesFile, `- [ ] ${text.replace(/\n/g, " ")} (${dateStamp(now())})`);
      },
      async list() {
        const content = await fs.readFile(notesFile, "utf8").catch(() => "");
        return content
          .split("\n")
          .map((line) => line.match(/^- \[ \] (.*?)(?: \(\d{4}-\d{2}-\d{2}\))?$/))
          .filter(Boolean)
          .map((m) => m[1]);
      },
      // No borra: marca las pendientes como hechas, para que el historial quede en la bóveda.
      async clear() {
        const content = await fs.readFile(notesFile, "utf8").catch(() => null);
        if (content === null) return;
        await fs.writeFile(notesFile, content.replace(/^- \[ \] /gm, "- [x] "), "utf8");
      }
    },

    async saveBriefing(text) {
      const file = path.join(ownDir, "Resúmenes", `${dateStamp(now())}.md`);
      await appendText(file, `## Resumen de las ${timeStamp(now())}\n\n${text}\n`);
      return rel(file);
    },

    async saveNews(news) {
      const file = path.join(ownDir, "Noticias", `${dateStamp(now())}.md`);
      const lines = [`# Radar de noticias — ${dateStamp(now())}`, "", `Actualizado: ${news.updatedAt}`, ""];
      for (const n of news.items) {
        lines.push(`- **[${n.topic}] ${n.title}** — ${n.summary} ([${n.source}](${n.url}))`);
      }
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, `${lines.join("\n")}\n`, "utf8");
      return rel(file);
    }
  };
}
