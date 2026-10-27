// Datos personales de Narvis, privados para cada persona. En la app de Claude se
// guardan en la base de datos del artifact, bajo data/users/<id>/:
//   memory → lo que Narvis sabe de ti   chat → la conversación   notes → tus notas
//   knowledge → documentos de tus proyectos (por ejemplo, tu TIC), cargados por Claude
// Si no hay base de datos (o no se puede escribir), se usa el navegador.

import { MAX_MEMORY } from "./brain.js";

const MAX_CHAT = 30; // intercambios guardados

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

// Un documento con escrituras en fila (la base pide una a la vez por documento).
function dbDoc(ref, field) {
  let queue = Promise.resolve();
  let broken = false;
  return {
    async read() {
      const snap = await ref.get();
      return snap.exists && Array.isArray(snap.data()[field]) ? [...snap.data()[field]] : [];
    },
    write(items) {
      queue = queue.then(async () => {
        if (broken) return;
        try {
          await ref.set({ [field]: items, updatedAt: new Date().toISOString() });
        } catch (error) {
          // Sin permiso de escritura (por ejemplo, alguien que solo puede ver la app).
          broken = true;
          console.warn("No se pudo guardar en la base de datos:", error);
        }
      });
      return queue;
    }
  };
}

function localDoc(key) {
  return { read: async () => loadLocal(key, []), write: async (items) => saveLocal(key, items) };
}

// Una lista guardada con lectura perezosa y copia en memoria.
function list(doc, max) {
  let items = null;
  const load = async () => (items ??= await doc.read().catch(() => []));
  const commit = () => doc.write((items = items.slice(-max)));
  return {
    async all() {
      return [...(await load())];
    },
    async add(...values) {
      await load();
      items.push(...values);
      await commit();
    },
    async remove(index) {
      await load();
      items.splice(index, 1);
      await commit();
    },
    async clear() {
      items = [];
      await commit();
    }
  };
}

export async function createStore() {
  const use = window.claude?.use;
  const [db, user] = use ? await Promise.all([use("db"), use("user")]) : [null, null];
  const id = user ? await user.id().catch(() => null) : null;
  let name = "";
  if (user) {
    const me = await user.me().catch(() => null);
    name = (me?.name || "").split(" ")[0];
  }

  const doc = (key) => (db && id ? dbDoc(db.doc(`data/users/${id}/${key}`), "items") : localDoc(`narvis.${key}`));
  const notes = list(doc("notes"), 200);
  return {
    name,
    persistent: Boolean(db && id),
    memory: list(doc("memory"), MAX_MEMORY),
    chat: list(doc("chat"), MAX_CHAT),
    knowledge: list(doc("knowledge"), 10),
    notes: { add: (text) => notes.add(text), list: () => notes.all(), clear: () => notes.clear() }
  };
}
