// Datos de Narvis. Dentro de la app de Claude usa su base de datos:
//   news/latest            → noticias (las actualiza una tarea programada)
//   data/users/<id>/notes  → notas privadas de cada persona
// Fuera de Claude, las notas viven en el navegador y no hay noticias.

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

// onNews(news) se llama cada vez que cambian las noticias (o con null si no hay).
export async function createStore({ onNews }) {
  const fallback = { notes: localNotes(), shared: false };
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
