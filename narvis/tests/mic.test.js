import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseMic } from "../js/mic.js";

const local = { protocol: "http:", secure: true };
const cause = (o) => diagnoseMic(o).cause;

test("detecta que se abrió el archivo directamente o sin localhost", () => {
  assert.equal(cause({ protocol: "file:", secure: false, code: "not-allowed" }), "file");
  assert.equal(cause({ protocol: "http:", secure: false, code: "not-allowed" }), "insecure");
});

test("distingue bloqueo de Chrome y del sistema operativo", () => {
  assert.equal(cause({ ...local, code: "NotAllowedError", permission: "denied" }), "browser-denied");
  assert.equal(cause({ ...local, code: "NotAllowedError", permission: "granted" }), "os-denied");
  assert.equal(cause({ ...local, code: "not-allowed", permission: "granted" }), "os-denied");
  assert.equal(cause({ ...local, code: "NotSupportedError", permission: "denied" }), "browser-denied");
});

test("reconoce micrófono ausente, ocupado, red y servicio", () => {
  assert.equal(cause({ ...local, code: "NotFoundError" }), "not-found");
  assert.equal(cause({ ...local, code: "NotReadableError" }), "in-use");
  assert.equal(cause({ ...local, code: "audio-capture" }), "in-use");
  assert.equal(cause({ ...local, code: "network" }), "network");
  assert.equal(cause({ ...local, code: "service-not-allowed" }), "service-not-allowed");
  assert.equal(cause({ ...local, code: "algo-raro" }), "unknown");
});

test("si el micrófono abre pero el dictado no, culpa al servicio", () => {
  assert.equal(cause({ ...local, code: "not-allowed", permission: "granted", micWorks: true }), "service-not-allowed");
});

test("el mensaje incluye el código para soporte", () => {
  assert.match(diagnoseMic({ ...local, code: "NotFoundError" }).text, /\(código: NotFoundError\)$/);
});
