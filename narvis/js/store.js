// Datos de Narvis, según dónde corre la app:
// - App de Claude: base de datos del artifact.
//     news/latest            → noticias (las actualiza una tarea programada)
//     data/users/<id>/notes  → notas privadas de cada persona
// - Servidor local (npm run server): noticias del servidor y notas en Obsidian.
// - Archivo suelto: notas en el navegador y sin noticias.

const NOTES_KEY = "narvis.notes";

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin persistencia */
  }
}

function localNotes() {
  let notes = loadLocal(NOTES_KEY, []);
  return {
    async add(note) {
      notes.push(note);
      saveLocal(NOTES_KEY, notes);
    },
    async list() {
      return [...notes];
    },
    async clear() {
      notes = [];
      saveLocal(NOTES_KEY, notes);
    }
  };
}

function dbNotes(ref) {
  let notes = null;
  const load = async () => {
    if (notes === null) {
      const snap = await ref.get();
      notes = snap.exists && Array.isArray(snap.data().items) ? [...snap.data().items] : [];
    }
    return notes;
  };
  return {
    async add(note) {
      await load();
      notes = [...notes, note];
      await ref.set({ items: notes });
    },
    async list() {
      return [...(await load())];
    },
    async clear() {
      notes = [];
      await ref.set({ items: [] });
    }
  };
}

const NEWS_POLL_MS = 5 * 60 * 1000;

function serverNotes() {
  const call = async (method, body) => {
    const res = await fetch("/api/notes", {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  return {
    add: (text) => call("POST", { text }),
    list: async () => (await call("GET")).notes,
    clear: () => call("DELETE")
  };
}

async function serverStore(status, onNews) {
  let lastUpdated = null;
  const load = async (refresh = false) => {
    try {
      const res = await fetch(`/api/news${refresh ? "?refresh=1" : ""}`);
      const { news, refreshing } = await res.json();
      if (news?.updatedAt !== lastUpdated) {
        lastUpdated = news?.updatedAt ?? null;
        onNews(news);
      }
      // Si el servidor está actualizando en segundo plano, volvemos a preguntar pronto.
      if (refreshing) setTimeout(load, 20000);
    } catch (error) {
      console.error("No se pudieron leer las noticias:", error);
    }
  };
  await load();
  setInterval(load, NEWS_POLL_MS);
  return {
    notes: status.obsidian ? serverNotes() : localNotes(),
    refreshNews: () => load(true)
  };
}

// onNews(news) se llama cada vez que cambian las noticias (o con null si no hay).
// serverStatus: respuesta de /api/status cuando hay servidor local.
export async function createStore({ onNews, serverStatus = null }) {
  const fallback = { notes: localNotes(), shared: false };
  if (serverStatus) return serverStore(serverStatus, onNews);
  if (!window.claude?.use) {
    onNews(null);
    return fallback;
  }

  const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
  if (!db) {
    onNews(null);
    return fallback;
  }

  db.doc("news/latest").onSnapshot(
    (snap) => onNews(snap.exists ? snap.data() : null),
    (error) => {
      console.error("No se pudieron leer las noticias:", error);
      onNews(null);
    }
  );

  const id = user ? await user.id() : null;
  const notes = id ? dbNotes(db.doc(`data/users/${id}/notes`)) : localNotes();
  return { notes, shared: true };
}
