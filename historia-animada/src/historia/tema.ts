// El estilo de la plantilla. Cuatro maneras de dibujar lo mismo (temas A-D); la plantilla usa la A, «Plano».
// que se elija en las maquetas; la elegida pasa a ser la del canal (TEMA_CANAL).
//   A «Plano»:    como la referencia: muñecos de cabeza redonda con contorno fino y palitos, colores planos, gris de fondo.
//   B «Cabezón»:  cabezas grandes en forma de huevo, contorno grueso, una sombra dura y un brillo (dibujos de tele).
//   C «Recortable»: figuras de papel recortado, sin contorno negro, con borde blanco y sombra; fondo de cartulina.
//   D «Libro»:    tinta de libro ilustrado antiguo, línea irregular, colores de acuarela y tramas; mapas de atlas viejo.
import { continueRender, delayRender, staticFile } from "remotion";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export type Variante = "A" | "B" | "C" | "D";
export type Dibujo = "plano" | "cabezon" | "papel" | "tinta";

export type Tema = {
  id: Variante;
  nombre: string;
  dibujo: Dibujo;
  tinta: string; // contorno de muñecos y objetos
  trazo: number; // grosor del contorno a tamaño 1
  palito: number; // grosor de brazos y piernas
  piel: string;
  pielSombra: string;
  fondo: string; // el fondo del narrador
  fondo2?: string; // segundo color del fondo (degradado o textura)
  letra: string; // letra de rótulos y palabras
  letraGorda: string; // cifras y palabras grandes
  claro: string; // texto sobre mapa o imagen
  oscuro: string; // texto sobre el fondo del narrador
  acento: string; // lo importante (rojo)
  mapa: "satelite" | "atlas";
  mapaFiltro: string; // retoque del satélite
  capaOpacidad: number;
  capaBorde: number;
  capaBordeColor: string;
  pin: string;
  papel: boolean; // textura de papel por encima
  cabeza: number; // radio de la cabeza a tamaño 1
};

export const TEMAS: Record<Variante, Tema> = {
  A: {
    id: "A", nombre: "Plano", dibujo: "plano", tinta: "#2b2724", trazo: 3.2, palito: 5, piel: "#f3dcc2", pielSombra: "#e2c6a6",
    fondo: "#c9c6bf", letra: "Patrick", letraGorda: "Kalam", claro: "#ffffff", oscuro: "#2b2724", acento: "#d8322a",
    mapa: "satelite", mapaFiltro: "saturate(1.18) brightness(1.08) contrast(1.04)", capaOpacidad: 0.62, capaBorde: 3,
    capaBordeColor: "rgba(255,255,255,0.75)", pin: "#f5c518", papel: false, cabeza: 58,
  },
  B: {
    id: "B", nombre: "Cabezón", dibujo: "cabezon", tinta: "#26201c", trazo: 6.5, palito: 13, piel: "#fbe6cf", pielSombra: "#e8c7a4",
    fondo: "#efe3c8", fondo2: "#e2d0a8", letra: "Gorda", letraGorda: "Gorda", claro: "#ffffff", oscuro: "#26201c", acento: "#e0412d",
    mapa: "satelite", mapaFiltro: "saturate(1.45) brightness(1.1) contrast(1.12)", capaOpacidad: 0.7, capaBorde: 6,
    capaBordeColor: "#26201c", pin: "#ffcf2e", papel: false, cabeza: 92,
  },
  C: {
    id: "C", nombre: "Recortable", dibujo: "papel", tinta: "#5a4634", trazo: 0, palito: 15, piel: "#f2cfa9", pielSombra: "#dcb48b",
    fondo: "#c9a77a", fondo2: "#b8925f", letra: "Patrick", letraGorda: "Kalam", claro: "#fffaf0", oscuro: "#3d2d1f", acento: "#c2402c",
    mapa: "satelite", mapaFiltro: "sepia(0.25) saturate(1.05) brightness(1.12) contrast(0.98)", capaOpacidad: 0.8, capaBorde: 5,
    capaBordeColor: "#fffaf0", pin: "#e8b33a", papel: true, cabeza: 64,
  },
  D: {
    id: "D", nombre: "Libro", dibujo: "tinta", tinta: "#2a211a", trazo: 2.4, palito: 4, piel: "#f1dcc0", pielSombra: "#d9bc98",
    fondo: "#eadcbc", fondo2: "#d9c39a", letra: "Fell", letraGorda: "Fell", claro: "#fbf3e1", oscuro: "#2a211a", acento: "#9e2b20",
    mapa: "atlas", mapaFiltro: "none", capaOpacidad: 0.55, capaBorde: 2.4, capaBordeColor: "#2a211a", pin: "#9e2b20",
    papel: true, cabeza: 54,
  },
};

/** El estilo del canal: el elegido en las maquetas (hasta entonces, A, el más parecido a la referencia). */
export const TEMA_CANAL: Variante = "A";

let pedidas = false;
export const cargarLetras = () => {
  if (pedidas) return;
  pedidas = true;
  // Lección de render: la carga de letras no puede dejar un delayRender sin soltar (se colgaba a los 4:48).
  const espera = delayRender("letras-terra", { timeoutInMilliseconds: 20000 });
  const letras: [string, string][] = [
    ["Mali", "Mali-Medium.ttf"], ["MaliB", "Mali-Bold.ttf"], ["Patrick", "PatrickHand-Regular.ttf"],
    ["Kalam", "Kalam-Bold.ttf"], ["Fell", "IMFellEnglish-Regular.ttf"], ["Mano", "ArchitectsDaughter-Regular.ttf"],
    ["Gorda", "Poppins-ExtraBold.ttf"],
  ];
  Promise.all(letras.map(([n, f]) => new FontFace(n, `url(${staticFile(`fuentes/${f}`)})`).load()
    .then((x) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(x)).catch(() => undefined)))
    .finally(() => continueRender(espera));
};
