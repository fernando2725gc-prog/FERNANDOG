// Lenguaje visual de los caballeros (medido sobre «Why Knights Stopped Using Shields», de la referencia, 26-10-2026):
// muñecos cabezones (la cabeza es casi la mitad del cuerpo), cara blanca con ojos redondos, contorno oscuro grueso
// de grosor fijo, colores planos con UNA sombra dura y un brillo; fondos de dibujo con nubes de borde ondulado,
// varias capas con desenfoque y lluvia. Animación por piezas, suave (30 imágenes por segundo) y con rebote al llegar.
import { continueRender, delayRender, staticFile } from "remotion";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const C = {
  tinta: "#2a2624", // contorno de los muñecos (casi negro, un poco cálido)
  cara: "#fbfaf5",
  caraSombra: "#e4e1d8",
  acero: "#c7ccd3",
  aceroSombra: "#9aa1ab",
  aceroOscuro: "#7d8590",
  aceroBrillo: "#f1f4f7",
  malla: "#a3a9b1",
  amarillo: "#f3c232",
  amarilloSombra: "#d39c1c",
  rojo: "#d6402c",
  rojoSombra: "#a92e20",
  azul: "#3e6bbd",
  azulSombra: "#2d4f91",
  cuero: "#8a5a34",
  cueroSombra: "#6b4325",
  madera: "#b9824a",
  maderaSombra: "#8e5f31",
  pluma: "#f3efe4",
  sudor: "#8fd0f5",
  estrella: "#ffd43b",
};

export const GROSOR = 6; // contorno de los muñecos a tamaño 1

let pedidas = false;
export const cargarFuentes = () => {
  if (pedidas) return;
  pedidas = true;
  const espera = delayRender("Fuentes");
  const fuentes = [
    new FontFace("Mano", `url(${staticFile("fuentes/ArchitectsDaughter-Regular.ttf")})`),
    new FontFace("Gorda", `url(${staticFile("fuentes/Poppins-ExtraBold.ttf")})`),
  ];
  Promise.all(fuentes.map((f) => f.load().then((x) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(x))))
    .catch(() => undefined)
    .finally(() => continueRender(espera));
};
