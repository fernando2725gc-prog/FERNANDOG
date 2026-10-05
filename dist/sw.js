/* =========================================================================
   sw.js — Para que la app ABRA sin conexión

   La cola local ya hacía que el trabajo no se perdiera sin señal, pero solo
   si la app ya estaba abierta: sin cobertura, el navegador no podía ni
   cargar la página. En la finca eso es justamente lo que pasa.

   Estrategia, y por qué esta y no otra:

     · La PÁGINA se pide primero a la red y solo se tira del cache si la red
       falla. Al revés —cache primero— una versión nueva publicada no
       llegaría hasta vaciar el cache a mano, y aquí se publica a menudo.
     · Los ICONOS y el manifiesto se sirven del cache y se refrescan por
       detrás: no cambian casi nunca y no vale la pena esperar por ellos.
     · Nada más se intercepta. Los datos viven en el almacén compartido, que
       tiene su propia cola para trabajar sin señal; cachear sus respuestas
       solo serviría para enseñar datos viejos como si fueran de ahora.
   ========================================================================= */

const VERSION = "tf-v2";
const ESENCIALES = ["./", "./manifest.json", "./pwa/icono-192.png", "./pwa/icono-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      /* Si uno falla —un icono que no está— no se cae la instalación
         entera: vale más una app que abre sin icono que una que no abre. */
      .then(function (c) {
        return Promise.all(ESENCIALES.map(function (u) {
          return c.add(u).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves.filter(function (k) { return k !== VERSION; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* La página: red primero, cache como red de seguridad. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          const copia = res.clone();
          caches.open(VERSION).then(function (c) { c.put("./", copia); });
          return res;
        })
        .catch(function () {
          return caches.match("./").then(function (c) {
            return c || new Response(
              "<!doctype html><meta charset='utf-8'><title>Sin conexión</title>" +
              "<body style='font:16px system-ui;padding:2rem;text-align:center'>" +
              "<h1>Sin conexión</h1><p>Abre la app una vez con señal para poder " +
              "usarla después sin ella.</p>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } });
          });
        })
    );
    return;
  }

  /* Iconos y manifiesto: del cache, y se refrescan por detrás. */
  if (/\.(png|json|svg|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (guardado) {
        const red = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copia); });
          }
          return res;
        }).catch(function () { return guardado; });
        return guardado || red;
      })
    );
  }
});
