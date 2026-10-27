// Diagnóstico del micrófono: averigua por qué no funciona y dice cómo arreglarlo.
// diagnoseMic es pura (se prueba con Node); probeMicrophone usa el navegador.

const MESSAGES = {
  "file":
    "Abriste el archivo index.html directamente y así Chrome no deja usar el micrófono. Cierra esta pestaña, inicia Narvis con iniciar-narvis.bat (o npm start) y entra a http://localhost:8000.",
  "insecure":
    "Chrome solo permite el micrófono en http://localhost o en sitios https. Abre Narvis en http://localhost:8000 en esta misma computadora.",
  "browser-denied":
    "Chrome tiene bloqueado el micrófono para esta página. Haz clic en el ícono a la izquierda de la dirección (localhost:8000), cambia «Micrófono» a «Permitir» y recarga la página.",
  "os-denied":
    "Chrome tiene permiso, pero tu sistema no le deja usar el micrófono. En Windows: Configuración › Privacidad y seguridad › Micrófono, activa «Acceso al micrófono» y «Permitir que las aplicaciones de escritorio accedan al micrófono». En Mac: Ajustes del Sistema › Privacidad y seguridad › Micrófono, activa Google Chrome y vuelve a abrirlo.",
  "not-found":
    "No encontré ningún micrófono. Conecta uno (o unos audífonos con micrófono) y revisa que esté elegido en chrome://settings/content/microphone.",
  "in-use":
    "No pude abrir el micrófono: otra aplicación lo está usando (Zoom, Teams, Discord…) o el sistema lo bloquea. Ciérrala y vuelve a pulsar «Activar micrófono».",
  "service-not-allowed":
    "Chrome no deja usar su servicio de dictado en este equipo. Pasa con Chromium, Brave o perfiles administrados por una empresa o escuela. Prueba con Google Chrome normal o con Microsoft Edge.",
  "network":
    "El dictado de Chrome usa los servidores de Google y no pude conectarme. Revisa tu internet, la VPN o el firewall. Si usas Brave u otro navegador basado en Chromium, no trae ese servicio: usa Google Chrome o Edge.",
  "language-not-supported":
    "Chrome no reconoce el idioma elegido. Elige Español (México) o Español (España) abajo.",
  "unsupported":
    "Este navegador no tiene reconocimiento de voz. Abre Narvis en Google Chrome o Microsoft Edge."
};

// Decide la causa a partir de lo que sabemos.
//   code: error de SpeechRecognition o de getUserMedia (nombre del DOMException)
//   protocol, secure: location.protocol y window.isSecureContext
//   permission: estado del permiso de micrófono en el navegador ("granted" | "denied" | "prompt" | null)
//   micWorks: el micrófono ya se abrió bien antes; entonces lo que falla es el dictado
export function diagnoseMic({ code, protocol, secure, permission, micWorks = false }) {
  let cause;
  if (protocol === "file:") cause = "file";
  else if (micWorks && code === "not-allowed") cause = "service-not-allowed";
  else if (secure === false) cause = "insecure";
  else if (code === "unsupported") cause = "unsupported";
  else if (code === "service-not-allowed") cause = "service-not-allowed";
  else if (code === "network") cause = "network";
  else if (code === "language-not-supported") cause = "language-not-supported";
  else if (code === "NotFoundError" || code === "OverconstrainedError") cause = "not-found";
  else if (code === "NotReadableError" || code === "AbortError" || code === "audio-capture") cause = "in-use";
  else if (code === "not-allowed" || code === "NotAllowedError" || code === "SecurityError") {
    // Si Chrome no lo tiene bloqueado, quien lo bloquea es el sistema operativo.
    cause = permission === "denied" ? "browser-denied" : permission === "granted" ? "os-denied" : "browser-denied";
  }
  // Con un código raro, el estado del permiso sigue siendo una pista fiable.
  if (!cause && permission === "denied") cause = "browser-denied";
  const text = cause ? MESSAGES[cause] : "No pude usar el micrófono.";
  return { cause: cause ?? "unknown", text: `${text} (código: ${code ?? cause})` };
}

async function permissionState() {
  try {
    return (await navigator.permissions.query({ name: "microphone" })).state;
  } catch {
    return null;
  }
}

// Pide el micrófono una vez (abre el aviso de permiso de Chrome) y lo suelta.
// Devuelve null si funciona, o el diagnóstico si no.
export async function probeMicrophone() {
  const base = { protocol: location.protocol, secure: window.isSecureContext };
  if (base.protocol === "file:" || !base.secure) return diagnoseMic(base);
  if (!navigator.mediaDevices?.getUserMedia) return diagnoseMic({ ...base, code: "unsupported" });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (error) {
    return diagnoseMic({ ...base, code: error?.name, permission: await permissionState() });
  }
}

// Para errores que llegan del reconocimiento de voz mientras escucha.
export async function diagnoseRecognitionError(code, { micWorks = false } = {}) {
  return diagnoseMic({
    code,
    micWorks,
    protocol: location.protocol,
    secure: window.isSecureContext,
    permission: await permissionState()
  });
}
