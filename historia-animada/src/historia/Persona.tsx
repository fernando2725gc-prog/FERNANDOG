// El muñeco de la plantilla : cabeza redonda grande, ojos de punto, cuerpo pequeño con ropa de época y brazos y
// piernas de palito. Usa la misma Pose que los caballeros del kit (src/motor/Caballero.tsx), así los gestos de
// src/plan/gestos.ts le valen. El origen es el punto entre los pies, en el suelo; mide unos 400 de alto a tamaño 1.
import React from "react";
import { Pose, POSE } from "../motor/Caballero";
import { azar } from "../motor/anim";
import { Forma, Linea, tono } from "./forma";
import { Tema } from "./tema";

export type Ojos = "normal" | "felices" | "cerrados" | "susto" | "entornados" | "enfado";
export type Boca = "nada" | "linea" | "sonrisa" | "o" | "abierta" | "triste";

export type Traje = {
  forma: "tunica" | "vestido" | "casaca" | "armadura" | "habito" | "chaleco";
  color: string; // la ropa
  ribete?: string; // el borde o los adornos
  capa?: string;
  pelo?: string;
  peinado?: "corto" | "melena" | "mono" | "calvo" | "revuelto" | "revuelto_viejo";
  barba?: string;
  bigote?: string; // solo bigote (sin barba)
  sombrero?: "corona" | "sombrero" | "morrion" | "turbante" | "boina" | "mitra" | "casco" | "gorro" | "copa" | "bicornio" | "corno" | "piel"
    | "laurel" | "nemes" | "plumas" | "kabuto" | "conico" | "frigio" | "gorra" | "kepis" | "tricornio" | "casco_griego" | "fez" | "ninguno";
  gorguera?: boolean; // cuello de lechuguilla blanco (siglos XVI-XVII)
  coronita?: boolean; // una coronita que asoma por debajo del gorro (un rey disfrazado)
  sombreroColor?: string;
  gafas?: boolean;
  panuelo?: string;
  piel?: string; // color de la piel (si no, el del tema)
};

/** La mascota de la plantilla: un cartógrafo-guía (chico: habla con la voz del vídeo) de pelo cobrizo revuelto, gafas
 *  redondas, un pañuelo grande verde vivo (su color) y chaleco de explorador, que lleva un mapa enrollado. Es nuestra;
 *  no se parece a la de la referencia (sombrero de ala con pluma roja, lanza y túnica amarilla rota). */
export const GUIA: Traje = { forma: "casaca", color: "#2c4a8a", ribete: "#e8b74a", pelo: "#2a1d14", peinado: "corto", bigote: "#2a1d14", gafas: true, sombrero: "boina", sombreroColor: "#7a1f2b" }; // «El cronista», mascota de la plantilla (17-11-2026)

export const TRAJES: Record<string, Traje> = {
  guia: GUIA,
  isabel: { forma: "vestido", color: "#a8262c", ribete: "#e8b74a", pelo: "#8a5a2b", peinado: "mono", sombrero: "corona", sombreroColor: "#f0c23b" },
  fernando: { forma: "tunica", color: "#2f4f8f", ribete: "#e8b74a", capa: "#9c2a24", pelo: "#3a2616", peinado: "corto", barba: "#3a2616", sombrero: "corona", sombreroColor: "#f0c23b" },
  colon: { forma: "casaca", color: "#3f5b43", ribete: "#d9c89a", pelo: "#d7d2c8", peinado: "melena", sombrero: "boina", sombreroColor: "#2b2724" }, // la gorra negra de su retrato de 1519
  conquistador: { forma: "armadura", color: "#b9bec6", ribete: "#8c939c", pelo: "#2e2018", peinado: "corto", barba: "#2e2018", sombrero: "morrion", sombreroColor: "#c4c9d0" },
  monje: { forma: "habito", color: "#6b4f37", pelo: "#4a3423", peinado: "calvo" },
  campesino: { forma: "tunica", color: "#9b8058", pelo: "#4a3423", peinado: "corto" },
  sultan: { forma: "vestido", color: "#2f7a55", ribete: "#e8b74a", barba: "#2a1d14", pelo: "#2a1d14", peinado: "corto", sombrero: "turbante", sombreroColor: "#f4efe3" },
  // genéricos por época (se cambian los colores con «colores» en el plan; si falta uno, se añade aquí en el mismo estilo)
  rey: { forma: "tunica", color: "#7a1f2b", ribete: "#e8b74a", capa: "#b5262b", pelo: "#6b4425", peinado: "corto", barba: "#6b4425", sombrero: "corona", sombreroColor: "#f0c23b" },
  reina: { forma: "vestido", color: "#2f4f8f", ribete: "#e8b74a", pelo: "#3a2616", peinado: "mono", sombrero: "corona", sombreroColor: "#f0c23b" },
  noble: { forma: "casaca", color: "#2f4f8f", ribete: "#e8b74a", pelo: "#ececec", peinado: "corto" },
  mercader: { forma: "casaca", color: "#7a5230", ribete: "#d9c89a", pelo: "#4a3423", peinado: "corto", barba: "#4a3423", sombrero: "boina", sombreroColor: "#2b2724" },
  campesina: { forma: "vestido", color: "#8a6a45", ribete: "#efe1bf", pelo: "#4a3423", peinado: "mono" },
  legionario: { forma: "armadura", color: "#c9a24a", ribete: "#8e1f2b", pelo: "#2e2018", peinado: "corto", sombrero: "casco", sombreroColor: "#c9a24a" },
  vikingo: { forma: "tunica", color: "#6b4f37", ribete: "#9a7a4a", pelo: "#d9b26a", peinado: "melena", barba: "#d9b26a", sombrero: "casco", sombreroColor: "#9aa1ab" },
  soldado_moderno: { forma: "casaca", color: "#6b7a3a", ribete: "#4f5a2a", pelo: "#3a2616", peinado: "corto", sombrero: "casco", sombreroColor: "#56632e" },
  politico: { forma: "casaca", color: "#3a3d45", ribete: "#ececec", pelo: "#3a2616", peinado: "corto" },
  papa: { forma: "habito", color: "#f4f1ea", ribete: "#e8b74a", pelo: "#ececec", peinado: "calvo", sombrero: "mitra", sombreroColor: "#f4f1ea" },
  obispo: { forma: "habito", color: "#6b2f6b", ribete: "#e8b74a", pelo: "#9a9a9a", peinado: "calvo", sombrero: "mitra", sombreroColor: "#f4f1ea" },
  felipe2: { forma: "casaca", color: "#26201c", ribete: "#e8b74a", pelo: "#c9b48a", peinado: "corto", barba: "#c9b48a", sombrero: "corona", sombreroColor: "#f0c23b" }, // Felipe II, siempre de negro
  fernando_mozo: { forma: "tunica", color: "#6b7f3a", ribete: "#4f5a2a", pelo: "#3a2616", peinado: "corto", sombrero: "boina", sombreroColor: "#5a4632", coronita: true }, // Fernando disfrazado de mozo de mulas (1469): la coronita le delata
  minero: { forma: "tunica", color: "#8a5a3c", ribete: "#d9a33a", pelo: "#2a1d14", peinado: "corto", sombrero: "gorro", sombreroColor: "#c2402c" },
  banquero: { forma: "casaca", color: "#2b2724", ribete: "#ececec", pelo: "#6b4425", peinado: "corto", barba: "#6b4425", sombrero: "boina", sombreroColor: "#7a1f2b", gorguera: true },
  ministro: { forma: "casaca", color: "#3a3d45", ribete: "#ececec", pelo: "#9a9a9a", peinado: "corto", barba: "#9a9a9a" },
  comisionado: { forma: "casaca", color: "#1f2f4f", ribete: "#ececec", pelo: "#6b4425", peinado: "corto", sombrero: "copa", sombreroColor: "#1d1c1a" },
  napoleon: { forma: "casaca", color: "#23315e", ribete: "#e8b74a", pelo: "#3a2616", peinado: "corto", sombrero: "bicornio", sombreroColor: "#1d1c1a" }, // Napoleón en 1797: casaca azul de general y bicornio
  soldado_frances: { forma: "casaca", color: "#2c4a8a", ribete: "#f4efe3", pelo: "#4a3423", peinado: "corto", sombrero: "bicornio", sombreroColor: "#26201c" }, // soldado de la Francia revolucionaria
  dux: { forma: "vestido", color: "#c9962f", ribete: "#f4efe3", capa: "#a8262c", pelo: "#ececec", peinado: "corto", barba: "#ececec", sombrero: "corno", sombreroColor: "#e2b13c" }, // el dux de Venecia: manto dorado, capa roja y el «corno» (gorro con cuerno detrás)
  // los mongoles (siglos XII-XIII): el «deel» (túnica cruzada con faja) y el gorro de copa redonda con el ala de piel
  mongol: { forma: "tunica", color: "#2f5f8a", ribete: "#e8b74a", pelo: "#1d1814", peinado: "corto", sombrero: "piel", sombreroColor: "#b5262b" },
  mongola: { forma: "vestido", color: "#7a2f5a", ribete: "#e8b74a", pelo: "#1d1814", peinado: "mono", sombrero: "piel", sombreroColor: "#2f5f8a" },
  tartaro: { forma: "tunica", color: "#5a4a2a", ribete: "#c9a24a", pelo: "#1d1814", peinado: "corto", barba: "#1d1814", sombrero: "piel", sombreroColor: "#3a3d45" }, // los tártaros, vecinos y enemigos de los mongoles
  gengis: { forma: "tunica", color: "#f1ebdc", ribete: "#c9962f", capa: "#7a1f2b", pelo: "#8a8a8a", peinado: "corto", barba: "#9a9a9a", sombrero: "piel", sombreroColor: "#f4f1ea" }, // Gengis Kan como en su retrato del álbum Yuan: gorro blanco y barba gris
  // Roma y Grecia
  senador: { forma: "tunica", color: "#f4f1ea", ribete: "#6b2f6b", pelo: "#3a2616", peinado: "corto" }, // la toga blanca con la franja púrpura de los senadores
  cesar: { forma: "tunica", color: "#f4f1ea", ribete: "#e8b74a", capa: "#6b2f6b", pelo: "#3a2616", peinado: "corto", sombrero: "laurel" }, // un emperador romano: toga, manto púrpura y corona de laurel
  visigodo: { forma: "tunica", color: "#5f6b3a", ribete: "#a8322b", capa: "#7a4a2a", pelo: "#c98a3a", peinado: "melena", barba: "#c98a3a", sombrero: "casco", sombreroColor: "#8f969e" }, // un guerrero visigodo (Alarico, 410): túnica, capa de lana, melena y barba rubias y casco de hierro
  romana: { forma: "vestido", color: "#9c3a3a", ribete: "#e8b74a", pelo: "#3a2616", peinado: "mono" }, // la stola de una romana
  griego: { forma: "armadura", color: "#c9a24a", ribete: "#8e1f2b", pelo: "#3a2616", peinado: "corto", barba: "#3a2616", sombrero: "casco_griego", sombreroColor: "#c9a24a" }, // un hoplita: coraza de bronce y casco corintio con cresta
  filosofo: { forma: "tunica", color: "#efe8d8", ribete: "#9a8a6a", pelo: "#d7d2c8", peinado: "calvo", barba: "#d7d2c8" }, // un sabio griego (Sócrates, Aristóteles)
  // Egipto
  faraon: { forma: "tunica", color: "#f4efe3", ribete: "#e8b74a", pelo: "#1d1814", peinado: "calvo", sombrero: "nemes" }, // el faraón con el «nemes» de rayas y la cobra
  egipcio: { forma: "tunica", color: "#f4efe3", ribete: "#3c7fd0", pelo: "#1d1814", peinado: "corto" }, // un egipcio de lino blanco
  egipcia: { forma: "vestido", color: "#f4efe3", ribete: "#20a8a0", pelo: "#1d1814", peinado: "melena" }, // una egipcia con la melena negra
  // Asia
  samurai: { forma: "armadura", color: "#8e1f2b", ribete: "#26201c", pelo: "#1d1814", peinado: "corto", sombrero: "kabuto", sombreroColor: "#26201c" }, // armadura lacada en rojo y el «kabuto» con su media luna
  emperador_chino: { forma: "vestido", color: "#e8b830", ribete: "#b5262b", pelo: "#1d1814", peinado: "corto", barba: "#1d1814", sombrero: "gorro", sombreroColor: "#26201c" }, // el emperador de China, de amarillo imperial
  chino: { forma: "tunica", color: "#5a7a9a", ribete: "#3a4a5a", pelo: "#1d1814", peinado: "corto", sombrero: "conico", sombreroColor: "#d9b26a" }, // un campesino chino con sombrero de paja
  japones: { forma: "vestido", color: "#3a4f7a", ribete: "#f4efe3", pelo: "#1d1814", peinado: "mono" }, // kimono
  // América
  azteca: { forma: "tunica", color: "#d8322a", ribete: "#f2c230", pelo: "#1d1814", peinado: "corto", sombrero: "plumas", sombreroColor: "#2fa35a" }, // un guerrero mexica con penacho de plumas
  inca: { forma: "tunica", color: "#b5262b", ribete: "#e8b74a", capa: "#e8b74a", pelo: "#1d1814", peinado: "corto", sombrero: "plumas", sombreroColor: "#b5262b" }, // el Sapa Inca: túnica roja y oro, plumas sobre la cinta
  indigena: { forma: "tunica", color: "#a8794e", ribete: "#d8322a", pelo: "#1d1814", peinado: "melena", sombrero: "plumas", sombreroColor: "#d8322a" }, // un nativo norteamericano con su tocado
  // Edad Media
  cruzado: { forma: "armadura", color: "#f4f1ea", ribete: "#b5262b", pelo: "#6b4425", peinado: "corto", barba: "#6b4425", sombrero: "casco", sombreroColor: "#9aa1ab" }, // un cruzado: sobreveste blanca con ribete rojo y casco
  caballero: { forma: "armadura", color: "#b9bec6", ribete: "#8c939c", pelo: "#6b4425", peinado: "corto", sombrero: "casco", sombreroColor: "#9aa1ab" }, // un caballero con armadura
  // siglos XVII-XIX
  mosquetero: { forma: "casaca", color: "#2c4a8a", ribete: "#e8b74a", pelo: "#4a3423", peinado: "melena", barba: "#4a3423", sombrero: "sombrero", sombreroColor: "#26201c" }, // siglo XVII: casaca y sombrero de ala
  colono: { forma: "casaca", color: "#7a5230", ribete: "#f4efe3", pelo: "#ececec", peinado: "corto", sombrero: "tricornio", sombreroColor: "#26201c" }, // siglo XVIII: peluca blanca y tricornio
  revolucionario: { forma: "casaca", color: "#2c4a8a", ribete: "#f4efe3", pelo: "#4a3423", peinado: "corto", sombrero: "frigio", sombreroColor: "#c8322b" }, // la Revolución francesa: el gorro frigio rojo
  otomano: { forma: "casaca", color: "#1f2f4f", ribete: "#e8b74a", pelo: "#2a1d14", peinado: "corto", barba: "#2a1d14", sombrero: "fez", sombreroColor: "#b5262b" }, // el Imperio otomano del siglo XIX, con fez
  // siglos XIX-XX
  obrero: { forma: "tunica", color: "#4f5a6a", ribete: "#3a4250", pelo: "#4a3423", peinado: "corto", sombrero: "gorra", sombreroColor: "#5a5048" }, // un obrero con gorra
  general: { forma: "casaca", color: "#2f3a52", ribete: "#e8b74a", pelo: "#9a9a9a", peinado: "corto", barba: "#9a9a9a", sombrero: "kepis", sombreroColor: "#2f3a52" }, // un general con gorra de plato y galones dorados
  soldado_1914: { forma: "casaca", color: "#8a7f55", ribete: "#5f5638", pelo: "#4a3423", peinado: "corto", sombrero: "casco", sombreroColor: "#6f6a48" }, // un soldado de la Primera Guerra Mundial
  reina_victoria: { forma: "vestido", color: "#26201c", ribete: "#f4efe3", pelo: "#9a9a9a", peinado: "mono", coronita: true }, // la reina Victoria: de luto y con una coronita
  nino: { forma: "tunica", color: "#6b8f4a", ribete: "#4f6a36", pelo: "#4a3423", peinado: "corto" }, // un niño (en el plan, «s»: 0.6)
  anciano: { forma: "tunica", color: "#7a6a55", ribete: "#5a4d3d", pelo: "#ececec", peinado: "revuelto_viejo", barba: "#ececec" }, // un anciano
  pirata: { forma: "casaca", color: "#26201c", ribete: "#b5262b", pelo: "#2a1d14", peinado: "melena", barba: "#2a1d14", sombrero: "sombrero", sombreroColor: "#26201c" },
  // Imperio británico (VID-100, 10-11-2026)
  isabel1: { forma: "vestido", color: "#f1ead8", ribete: "#d9a92c", pelo: "#c0562a", peinado: "mono", gorguera: true, sombrero: "corona", sombreroColor: "#f0c23b" }, // Isabel I: pelo rojo, gorguera y vestido blanco y oro
  drake: { forma: "casaca", color: "#26201c", ribete: "#d9a92c", pelo: "#8a5a34", peinado: "corto", barba: "#8a5a34", gorguera: true, sombrero: "sombrero", sombreroColor: "#26201c" }, // Francis Drake, corsario con gorguera
  casaca_roja: { forma: "casaca", color: "#b8262b", ribete: "#f4efe3", pelo: "#ececec", peinado: "corto", sombrero: "tricornio", sombreroColor: "#26201c" }, // soldado británico del siglo XVIII (Quebec, Plassey, Yorktown)
  casaca_roja_xix: { forma: "casaca", color: "#b8262b", ribete: "#f4efe3", pelo: "#4a3423", peinado: "corto", sombrero: "kepis", sombreroColor: "#26201c" }, // soldado británico del siglo XIX (Waterloo, la India, Sudán)
  caqui: { forma: "casaca", color: "#a08a5a", ribete: "#6f5f3a", pelo: "#4a3423", peinado: "corto", barba: "#4a3423", sombrero: "sombrero", sombreroColor: "#b5a070" }, // soldado británico de las colonias (guerra bóer, salacot caqui)
  boer: { forma: "chaleco", color: "#6b5a3e", ribete: "#4a3d28", pelo: "#6b4a2a", peinado: "corto", barba: "#6b4a2a", sombrero: "sombrero", sombreroColor: "#5a4a32" }, // granjero bóer con barba y sombrero de ala
  cipayo: { forma: "casaca", color: "#b8262b", ribete: "#f4efe3", pelo: "#1f1712", peinado: "corto", barba: "#1f1712", sombrero: "turbante", sombreroColor: "#f1ead8" , piel: "#a8724a" }, // soldado indio del ejército de la Compañía (turbante y casaca roja)
  nawab: { forma: "tunica", color: "#2f6b5a", ribete: "#e8b74a", pelo: "#1f1712", peinado: "corto", barba: "#1f1712", sombrero: "turbante", sombreroColor: "#e8b74a" , piel: "#a8724a" }, // príncipe indio (el nawab de Bengala, el emperador mogol)
  indio: { forma: "tunica", color: "#f1ead8", ribete: "#c9b48a", pelo: "#1f1712", peinado: "corto", sombrero: "turbante", sombreroColor: "#e07a2a" , piel: "#a8724a" }, // campesino o manifestante indio
  gandhi: { forma: "tunica", color: "#f4f1ea", ribete: "#d8d2c2", pelo: "#ececec", peinado: "calvo", gafas: true , piel: "#a8724a" }, // Gandhi: calvo, gafas redondas y tela blanca hilada a mano
  churchill: { forma: "casaca", color: "#2a2a30", ribete: "#f4efe3", pelo: "#d8d2c2", peinado: "calvo", sombrero: "copa", sombreroColor: "#1e1e22" }, // Churchill: traje oscuro, calvo, sombrero
  thatcher: { forma: "vestido", color: "#1f3f8a", ribete: "#f4efe3", pelo: "#c9a46a", peinado: "corto" }, // Margaret Thatcher, de azul
  irlandes: { forma: "tunica", color: "#5a6b3a", ribete: "#3e4a28", pelo: "#a4532c", peinado: "revuelto", sombrero: "boina", sombreroColor: "#4a4038" }, // campesino irlandés
  aborigen: { forma: "tunica", color: "#8a5a34", ribete: "#5f3c22", pelo: "#1f1712", peinado: "revuelto", barba: "#1f1712" , piel: "#6e4a32" }, // aborigen australiano
  sudanes: { forma: "tunica", color: "#f4f1ea", ribete: "#c9b48a", pelo: "#1f1712", peinado: "corto", barba: "#1f1712", sombrero: "turbante", sombreroColor: "#f4f1ea" , piel: "#6e4a32" }, // guerrero sudanés del Mahdi, de blanco
  africano: { forma: "tunica", color: "#d08a2a", ribete: "#8a4f1a", pelo: "#1f1712", peinado: "corto" , piel: "#6e4a32" }, // africano (Kenia, Sudáfrica, Ghana)
  chino_qing: { forma: "tunica", color: "#2f4f8f", ribete: "#e8b74a", pelo: "#1f1712", peinado: "corto", barba: "#1f1712", sombrero: "conico", sombreroColor: "#7a1f2b" , piel: "#ecc9a0" }, // funcionario chino de los Qing (Lin Zexu)
  // Segunda Guerra Mundial (VID-128, 16-11-2026)
  hitler: { forma: "casaca", color: "#8a7a5a", ribete: "#5a4a32", pelo: "#2a1d14", peinado: "corto", bigote: "#2a1d14", sombrero: "kepis", sombreroColor: "#8a7a5a" }, // Hitler: guerrera parda, gorra de plato, bigotito
  stalin: { forma: "casaca", color: "#b9ad8a", ribete: "#8a7f5f", pelo: "#3a3330", peinado: "corto", bigote: "#3a3330" }, // Stalin: guerrera clara y bigote grande
  mussolini: { forma: "casaca", color: "#26201c", ribete: "#9a9a9a", pelo: "#3a2616", peinado: "calvo", sombrero: "kepis", sombreroColor: "#26201c" }, // Mussolini: camisa negra y calvo
  chamberlain: { forma: "casaca", color: "#3a3d45", ribete: "#ececec", pelo: "#9a9a9a", peinado: "corto", bigote: "#9a9a9a" }, // Chamberlain: traje oscuro, bigote canoso (lleva paraguas o un papel)
  roosevelt: { forma: "casaca", color: "#4a4a52", ribete: "#ececec", pelo: "#9a9a9a", peinado: "corto", gafas: true }, // Roosevelt, con quevedos
  soldado_aleman: { forma: "casaca", color: "#6f7468", ribete: "#4f5348", pelo: "#6b4a2a", peinado: "corto", sombrero: "casco", sombreroColor: "#5a5f55" }, // soldado alemán de 1939-1945: gris verdoso y casco de acero
  soldado_sovietico: { forma: "casaca", color: "#8f8a5a", ribete: "#6a663f", pelo: "#4a3423", peinado: "corto", sombrero: "casco", sombreroColor: "#5f6b3a" }, // soldado soviético: guerrera caqui y casco verde
  soldado_usa: { forma: "casaca", color: "#7a7448", ribete: "#5a5534", pelo: "#6b4a2a", peinado: "corto", sombrero: "casco", sombreroColor: "#5d6338" }, // soldado estadounidense: verde oliva
  soldado_britanico: { forma: "casaca", color: "#9a875a", ribete: "#6f5f3a", pelo: "#4a3423", peinado: "corto", sombrero: "casco", sombreroColor: "#6f6a48" }, // soldado británico de 1940
  soldado_frances40: { forma: "casaca", color: "#7a7f8a", ribete: "#5a5f6a", pelo: "#3a2616", peinado: "corto", sombrero: "casco", sombreroColor: "#5f6a7a" }, // soldado francés de 1940 (azul horizonte)
  soldado_japones: { forma: "casaca", color: "#8f8456", ribete: "#6a6038", pelo: "#1f1712", peinado: "corto", sombrero: "gorra", sombreroColor: "#7a7046" , piel: "#ecc9a0" }, // soldado japonés: caqui y gorra
  piloto: { forma: "chaleco", color: "#6b4a2e", ribete: "#d8cdb5", pelo: "#a4532c", peinado: "corto", sombrero: "gorro", sombreroColor: "#4a3423" }, // piloto de la RAF con cazadora de cuero
  almirante_jp: { forma: "casaca", color: "#26201c", ribete: "#e8b74a", pelo: "#1f1712", peinado: "corto", sombrero: "kepis", sombreroColor: "#26201c" , piel: "#ecc9a0" }, // almirante japonés de azul oscuro
  einstein: { forma: "casaca", color: "#5a5048", ribete: "#ececec", pelo: "#ececec", peinado: "revuelto_viejo", bigote: "#ececec" }, // Einstein: pelo blanco revuelto y bigote
  civil: { forma: "casaca", color: "#5a5f6a", ribete: "#3a3d45", pelo: "#4a3423", peinado: "corto", sombrero: "sombrero", sombreroColor: "#3a3530" }, // un civil de los años 30-40 con sombrero
  civil_mujer: { forma: "vestido", color: "#6a4a5a", ribete: "#3a2a32", pelo: "#6b4425", peinado: "mono" }, // una mujer de los años 30-40
};

type Medidas = { cadera: number; hombro: number; anchoH: number; anchoB: number; brazo: number; antebrazo: number; r: number; ry: number };
const medidas = (t: Tema): Medidas => {
  const r = t.cabeza;
  switch (t.dibujo) {
    case "cabezon": return { cadera: 100, hombro: 192, anchoH: 62, anchoB: 82, brazo: 42, antebrazo: 38, r, ry: r * 1.08 };
    case "papel": return { cadera: 132, hombro: 240, anchoH: 60, anchoB: 82, brazo: 54, antebrazo: 48, r, ry: r };
    case "tinta": return { cadera: 150, hombro: 262, anchoH: 52, anchoB: 74, brazo: 60, antebrazo: 54, r, ry: r * 1.04 };
    default: return { cadera: 138, hombro: 248, anchoH: 54, anchoB: 76, brazo: 58, antebrazo: 52, r, ry: r };
  }
};

const rad = (g: number) => (g * Math.PI) / 180;

type Props = {
  tema: Tema;
  traje?: Traje;
  pose?: Pose;
  frame: number;
  semilla?: number;
  ojos?: Ojos;
  boca?: Boca;
  habla?: boolean; // abre y cierra la boca
  lleva?: React.ReactNode; // lo que lleva en la mano derecha de la pantalla (se gira con el antebrazo)
  llevaI?: React.ReactNode;
  sentado?: boolean; // sentado en un trono o una silla (la cadera a la altura del asiento)
  quitado?: boolean; // se ha quitado el sombrero (o la corona): lo lleva en la mano derecha
  montado?: boolean; // va a caballo (sentado, sin sombra en el suelo y con las piernas a los lados)
};

export const Persona: React.FC<Props> = ({ tema: temaBase, traje = GUIA, pose = POSE, frame, semilla = 1, ojos = "normal", boca = "linea", habla, lleva, llevaI, sentado: sentadoP, quitado, montado }) => {
  const tema = traje.piel ? { ...temaBase, piel: traje.piel, pielSombra: tono(traje.piel, -0.12) } : temaBase;
  const m = medidas(tema);
  const sentado = sentadoP || montado;
  const uid = React.useId().replace(/:/g, ""); // para los recortes (clipPath) de cada muñeco
  const tr = traje;
  // respira y parpadea (cada 2,5-4 s)
  const resp = Math.sin((frame / (60 + azar(semilla) * 20)) * Math.PI * 2 + semilla) * 2.2;
  const cada = 80 + Math.floor(azar(semilla + 9) * 40);
  const parpadea = (frame + Math.floor(azar(semilla + 3) * cada)) % cada < 4;
  const bocaAhora: Boca = habla ? (Math.floor(frame / 3 + azar(semilla) * 5) % 3 === 0 ? "linea" : Math.floor(frame / 3) % 2 ? "abierta" : "o") : boca;
  const ojosAhora: Ojos = parpadea && ojos !== "cerrados" && ojos !== "felices" ? "cerrados" : ojos;

  const baja = pose.agacha * 0.6 + pose.salto * -1;
  const cad = (sentado ? -m.cadera * 0.62 : -m.cadera) + baja;
  const hom = cad - (m.hombro - m.cadera) + resp * 0.4;
  const mira = pose.mira;
  const cabX = Math.sin(rad(pose.cabeza)) * 20 + Math.sin(rad(pose.tronco)) * 40;
  const cabY = hom - m.ry * 0.92 + pose.cabezaY + resp * 0.3;

  // piernas: de la cadera al pie, con rodilla si se agacha
  const pierna = (lado: number) => {
    // a caballo: las piernas abiertas a los dos lados del lomo, colgando por los flancos
    if (montado) return [[lado * 13, cad], [lado * 60, cad + 34], [lado * 54, 0]] as [number, number][];
    if (sentado) return [[lado * 13, cad], [lado * 24, cad + 10], [lado * 26, 0]] as [number, number][];
    const sep = (lado > 0 ? pose.pieD : pose.pieI) * 1.1;
    const alza = lado > 0 ? pose.alzaD : pose.alzaI;
    const cx = lado * 13, cy = cad;
    const px = lado * (19 + sep), py = -alza;
    const L = m.cadera - 4;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist >= L - 1) return [[cx, cy], [px, py]] as [number, number][];
    const k = Math.sqrt(Math.max(0, (L / 2) ** 2 - (dist / 2) ** 2));
    const mx = (cx + px) / 2 + (mira >= 0 ? 1 : -1) * k, my = (cy + py) / 2;
    return [[cx, cy], [mx, my], [px, py]] as [number, number][];
  };
  // brazos: hombro → codo → mano (ángulos desde abajo; + = hacia fuera)
  const brazo = (lado: number) => {
    const a = lado > 0 ? pose.bd : pose.bi;
    const c = lado > 0 ? pose.cd : pose.ci;
    const hx = lado * (m.anchoH / 2 - 4), hy = hom + 8;
    const ex = hx + lado * Math.sin(rad(a)) * m.brazo, ey = hy + Math.cos(rad(a)) * m.brazo;
    const mx = ex + lado * Math.sin(rad(a + c)) * m.antebrazo, my = ey + Math.cos(rad(a + c)) * m.antebrazo;
    return { pts: [[hx, hy], [ex, ey], [mx, my]] as [number, number][], mano: [mx, my] as [number, number], ang: lado * (a + c) };
  };
  const bD = brazo(1), bI = brazo(-1);
  const manga = tema.dibujo === "plano" || tema.dibujo === "tinta" ? undefined : tr.forma === "armadura" ? tr.color : tr.color;
  const piernaColor = tr.forma === "armadura" ? "#8c939c" : tono(tr.color, -0.35);

  // la ropa
  const hem = tr.forma === "vestido" || tr.forma === "habito" ? -14 : cad + 18;
  const anchoBajo = tr.forma === "vestido" || tr.forma === "habito" ? m.anchoB * 1.65 : m.anchoB;
  const wH = m.anchoH / 2, wB = anchoBajo / 2;
  const cuerpo = `M ${-wH} ${hom + 6} Q ${-wH} ${hom - 4} ${-wH + 10} ${hom - 4} L ${wH - 10} ${hom - 4} Q ${wH} ${hom - 4} ${wH} ${hom + 6} L ${wB} ${hem} Q 0 ${hem + 6} ${-wB} ${hem} Z`;
  const largoCapa = cad + 60;

  // cabeza
  const r = m.r, ry = m.ry;
  const hx = cabX, hy = cabY;
  const fx = hx + mira * r * 0.28; // la cara se va hacia donde mira
  const ojoSep = r * 0.33, ojoY = hy - r * 0.04;
  const tinta = tema.tinta;
  const grandes = tema.dibujo === "cabezon";

  const Ojo: React.FC<{ x: number }> = ({ x }) => {
    const px = x + pose.ojoX * r * 0.06, py = ojoY + pose.ojoY * r * 0.05;
    if (ojosAhora === "cerrados") return <path d={`M ${x - r * 0.1} ${ojoY} L ${x + r * 0.1} ${ojoY}`} stroke={tinta} strokeWidth={Math.max(2.5, r * 0.055)} strokeLinecap="round" />;
    if (ojosAhora === "felices") return <path d={`M ${x - r * 0.1} ${ojoY + r * 0.03} Q ${x} ${ojoY - r * 0.1} ${x + r * 0.1} ${ojoY + r * 0.03}`} stroke={tinta} strokeWidth={Math.max(2.5, r * 0.055)} fill="none" strokeLinecap="round" />;
    if (grandes) {
      const big = ojosAhora === "susto" ? 1.25 : 1;
      return (
        <g>
          <ellipse cx={x} cy={ojoY} rx={r * 0.15 * big} ry={r * 0.19 * big} fill="#fff" stroke={tinta} strokeWidth={tema.trazo * 0.7} />
          <circle cx={px + mira * r * 0.03} cy={py + r * 0.02} r={r * 0.075} fill={tinta} />
          {ojosAhora === "entornados" && <rect x={x - r * 0.17} y={ojoY - r * 0.22} width={r * 0.34} height={r * 0.17} fill={tema.piel} stroke={tinta} strokeWidth={tema.trazo * 0.6} />}
        </g>
      );
    }
    const rr = (ojosAhora === "susto" ? 0.11 : 0.075) * r;
    return (
      <g>
        <circle cx={px} cy={py} r={Math.max(3, rr)} fill={tinta} />
        {ojosAhora === "susto" && <circle cx={px - rr * 0.3} cy={py - rr * 0.3} r={rr * 0.3} fill="#fff" />}
        {ojosAhora === "entornados" && <path d={`M ${x - r * 0.13} ${ojoY - r * 0.04} L ${x + r * 0.13} ${ojoY - r * 0.04}`} stroke={tinta} strokeWidth={Math.max(2.5, r * 0.05)} strokeLinecap="round" />}
      </g>
    );
  };
  const by = hy + r * (tr.barba ? 0.44 : 0.38);
  const bw = r * 0.16;
  const Bocas: Record<Boca, React.ReactNode> = {
    nada: null,
    linea: <path d={`M ${fx - bw * 0.6} ${by} L ${fx + bw * 0.6} ${by}`} stroke={tinta} strokeWidth={Math.max(2.4, r * 0.045)} strokeLinecap="round" />,
    sonrisa: <path d={`M ${fx - bw} ${by - r * 0.03} Q ${fx} ${by + r * 0.12} ${fx + bw} ${by - r * 0.03}`} stroke={tinta} strokeWidth={Math.max(2.4, r * 0.045)} fill="none" strokeLinecap="round" />,
    triste: <path d={`M ${fx - bw} ${by + r * 0.06} Q ${fx} ${by - r * 0.06} ${fx + bw} ${by + r * 0.06}`} stroke={tinta} strokeWidth={Math.max(2.4, r * 0.045)} fill="none" strokeLinecap="round" />,
    o: <ellipse cx={fx} cy={by + r * 0.02} rx={r * 0.07} ry={r * 0.09} fill="#7a2a22" stroke={tinta} strokeWidth={Math.max(1.8, r * 0.035)} />,
    abierta: <path d={`M ${fx - bw} ${by - r * 0.02} Q ${fx} ${by - r * 0.04} ${fx + bw} ${by - r * 0.02} Q ${fx + bw * 0.6} ${by + r * 0.2} ${fx} ${by + r * 0.2} Q ${fx - bw * 0.6} ${by + r * 0.2} ${fx - bw} ${by - r * 0.02} Z`} fill="#7a2a22" stroke={tinta} strokeWidth={Math.max(1.8, r * 0.035)} strokeLinejoin="round" />,
  };

  const pelo = tr.pelo;
  const peinado = tr.peinado ?? "corto";
  const PeloDetras = pelo && (peinado === "melena" || peinado === "mono") ? (
    peinado === "melena"
      ? <Forma tema={tema} fill={pelo} d={`M ${hx - r * 1.0} ${hy - r * 0.1} Q ${hx - r * 1.1} ${hy + r * 0.55} ${hx - r * 0.82} ${hy + r * 0.72} L ${hx + r * 0.82} ${hy + r * 0.72} Q ${hx + r * 1.1} ${hy + r * 0.55} ${hx + r * 1.0} ${hy - r * 0.1} Z`} />
      : <Forma tema={tema} fill={pelo} cx={hx - mira * r * 0.55} cy={hy - r * 0.62} r={r * 0.36} />
  ) : null;
  const PeloDelante = pelo && peinado !== "calvo" ? (
    peinado === "revuelto"
      ? <Forma tema={tema} fill={pelo} d={`M ${hx - r * 0.99} ${hy - r * 0.02} Q ${hx - r * 1.12} ${hy - r * 0.75} ${hx - r * 0.62} ${hy - r * 0.98} L ${hx - r * 0.72} ${hy - r * 1.28} L ${hx - r * 0.34} ${hy - r * 1.08} L ${hx - r * 0.12} ${hy - r * 1.38} L ${hx + r * 0.12} ${hy - r * 1.1} L ${hx + r * 0.48} ${hy - r * 1.3} L ${hx + r * 0.56} ${hy - r * 1.0} Q ${hx + r * 1.12} ${hy - r * 0.85} ${hx + r * 0.99} ${hy - r * 0.1} Q ${hx + r * 0.75} ${hy - r * 0.42} ${hx + r * 0.52} ${hy - r * 0.5} L ${hx + r * 0.38} ${hy - r * 0.68} L ${hx + mira * r * 0.25 + r * 0.05} ${hy - r * 0.52} L ${hx - r * 0.2} ${hy - r * 0.7} Q ${hx - r * 0.55} ${hy - r * 0.5} ${hx - r * 0.99} ${hy - r * 0.02} Z`} />
      : peinado === "revuelto_viejo"
      ? <Forma tema={tema} fill={pelo} d={`M ${hx - r * 0.98} ${hy - r * 0.05} Q ${hx - r * 1.1} ${hy - r * 0.9} ${hx - r * 0.3} ${hy - r * 1.08} Q ${hx - r * 0.1} ${hy - r * 1.32} ${hx + r * 0.25} ${hy - r * 1.1} Q ${hx + r * 0.6} ${hy - r * 1.25} ${hx + r * 0.75} ${hy - r * 0.95} Q ${hx + r * 1.12} ${hy - r * 0.7} ${hx + r * 0.98} ${hy - r * 0.15} Q ${hx + r * 0.6} ${hy - r * 0.55} ${hx + mira * r * 0.3} ${hy - r * 0.6} Q ${hx - r * 0.55} ${hy - r * 0.55} ${hx - r * 0.98} ${hy - r * 0.05} Z`} />
      : <Forma tema={tema} fill={pelo} d={`M ${hx - r * 0.99} ${hy - r * 0.08} Q ${hx - r * 0.95} ${hy - r * 1.06} ${hx} ${hy - r * 1.04} Q ${hx + r * 0.95} ${hy - r * 1.06} ${hx + r * 0.99} ${hy - r * 0.08} Q ${hx + r * 0.55} ${hy - r * 0.62} ${hx + mira * r * 0.2} ${hy - r * 0.62} Q ${hx - r * 0.55} ${hy - r * 0.62} ${hx - r * 0.99} ${hy - r * 0.08} Z`} />
  ) : null;
  // barba por la mandíbula (sin tapar la boca) y bigote encima: antes la barba entera parecía una mascarilla
  const Barba = tr.barba ? (
    <Forma tema={tema} fill={tr.barba} d={`M ${hx - r * 0.92} ${hy + r * 0.02} Q ${hx - r * 0.8} ${hy + r * 1.0} ${fx} ${hy + r * 1.12} Q ${hx + r * 0.8} ${hy + r * 1.0} ${hx + r * 0.92} ${hy + r * 0.02} Q ${hx + r * 0.74} ${hy + r * 0.6} ${fx + r * 0.3} ${hy + r * 0.58} Q ${fx} ${hy + r * 0.7} ${fx - r * 0.3} ${hy + r * 0.58} Q ${hx - r * 0.74} ${hy + r * 0.6} ${hx - r * 0.92} ${hy + r * 0.02} Z`} />
  ) : null;
  const Bigote = (tr.barba || tr.bigote) ? <Forma tema={tema} fill={(tr.barba ?? tr.bigote) as string} d={`M ${fx - r * 0.3} ${hy + r * 0.36} Q ${fx - r * 0.1} ${hy + r * 0.22} ${fx} ${hy + r * 0.29} Q ${fx + r * 0.1} ${hy + r * 0.22} ${fx + r * 0.3} ${hy + r * 0.36} Q ${fx} ${hy + r * 0.33} ${fx - r * 0.3} ${hy + r * 0.36} Z`} grosor={0.6} /> : null;
  const sc = tr.sombreroColor ?? "#6b4a2e";
  // el sombrero se dibuja en la cabeza o, si se lo ha quitado («quita_sombrero»), en la mano derecha
  const dibSombrero = (hx: number, hy: number) => {
    switch (tr.sombrero) {
      case "corona": return <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.6} ${hy - r * 0.78} L ${hx - r * 0.66} ${hy - r * 1.28} L ${hx - r * 0.33} ${hy - r * 1.02} L ${hx} ${hy - r * 1.36} L ${hx + r * 0.33} ${hy - r * 1.02} L ${hx + r * 0.66} ${hy - r * 1.28} L ${hx + r * 0.6} ${hy - r * 0.78} Z`} />;
      case "morrion": return (
        <g>
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 1.25} ${hy - r * 0.55} Q ${hx} ${hy - r * 0.25} ${hx + r * 1.25} ${hy - r * 0.55} Q ${hx + r * 0.9} ${hy - r * 0.72} ${hx + r * 0.75} ${hy - r * 0.78} Q ${hx + r * 0.7} ${hy - r * 1.5} ${hx} ${hy - r * 1.62} Q ${hx - r * 0.7} ${hy - r * 1.5} ${hx - r * 0.75} ${hy - r * 0.78} Q ${hx - r * 0.9} ${hy - r * 0.72} ${hx - r * 1.25} ${hy - r * 0.55} Z`} brillo />
        </g>
      );
      case "sombrero": return (
        <g>
          <Forma tema={tema} fill={sc} rx={r * 1.25} ry={r * 0.22} cx={hx} cy={hy - r * 0.78} />
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.62} ${hy - r * 0.8} Q ${hx - r * 0.6} ${hy - r * 1.45} ${hx} ${hy - r * 1.45} Q ${hx + r * 0.6} ${hy - r * 1.45} ${hx + r * 0.62} ${hy - r * 0.8} Z`} />
        </g>
      );
      case "turbante": return <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.98} ${hy - r * 0.35} Q ${hx - r * 1.1} ${hy - r * 1.4} ${hx} ${hy - r * 1.45} Q ${hx + r * 1.1} ${hy - r * 1.4} ${hx + r * 0.98} ${hy - r * 0.35} Q ${hx} ${hy - r * 0.6} ${hx - r * 0.98} ${hy - r * 0.35} Z`} />;
      case "boina": return <Forma tema={tema} fill={sc} d={`M ${hx - r * 1.05} ${hy - r * 0.55} Q ${hx - r * 0.9} ${hy - r * 1.25} ${hx + r * 0.2} ${hy - r * 1.2} Q ${hx + r * 1.15} ${hy - r * 1.05} ${hx + r * 1.0} ${hy - r * 0.55} Z`} />;
      case "casco": return <Forma tema={tema} fill={sc} d={`M ${hx - r * 1.08} ${hy - r * 0.32} Q ${hx - r * 1.1} ${hy - r * 1.32} ${hx} ${hy - r * 1.34} Q ${hx + r * 1.1} ${hy - r * 1.32} ${hx + r * 1.08} ${hy - r * 0.32} Q ${hx} ${hy - r * 0.5} ${hx - r * 1.08} ${hy - r * 0.32} Z`} brillo />;
      case "gorro": return (
        <g>
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.98} ${hy - r * 0.2} Q ${hx - r * 1.0} ${hy - r * 1.25} ${hx} ${hy - r * 1.28} Q ${hx + r * 1.0} ${hy - r * 1.25} ${hx + r * 0.98} ${hy - r * 0.2} L ${hx + r * 0.92} ${hy + r * 0.38} L ${hx + r * 0.72} ${hy - r * 0.12} Q ${hx} ${hy - r * 0.4} ${hx - r * 0.72} ${hy - r * 0.12} L ${hx - r * 0.92} ${hy + r * 0.38} Z`} />
          <path d={`M ${hx - r * 0.85} ${hy - r * 0.62} Q ${hx} ${hy - r * 0.85} ${hx + r * 0.85} ${hy - r * 0.62}`} stroke="#f2c230" strokeWidth={r * 0.12} fill="none" />
          <circle cx={hx} cy={hy - r * 1.32} r={r * 0.14} fill="#f2c230" stroke={tema.tinta} strokeWidth={tema.trazo * 0.7} />
        </g>
      );
      case "copa": return (
        <g>
          <Forma tema={tema} fill={sc} rx={r * 0.95} ry={r * 0.16} cx={hx} cy={hy - r * 0.8} />
          <Forma tema={tema} fill={sc} x={hx - r * 0.58} y={hy - r * 1.9} w={r * 1.16} h={r * 1.12} esq={4} />
          <rect x={hx - r * 0.58} y={hy - r * 1.02} width={r * 1.16} height={r * 0.16} fill="#7a1f2b" />
        </g>
      );
      case "bicornio": return (
        <g>
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 1.35} ${hy - r * 0.62} Q ${hx - r * 0.7} ${hy - r * 1.62} ${hx} ${hy - r * 1.42} Q ${hx + r * 0.7} ${hy - r * 1.62} ${hx + r * 1.35} ${hy - r * 0.62} Q ${hx} ${hy - r * 0.92} ${hx - r * 1.35} ${hy - r * 0.62} Z`} />
          <circle cx={hx + r * 0.1} cy={hy - r * 1.1} r={r * 0.15} fill="#2c4a8a" stroke="#f4efe3" strokeWidth={r * 0.05} />
          <circle cx={hx + r * 0.1} cy={hy - r * 1.1} r={r * 0.06} fill="#c8322b" />
        </g>
      );
      case "corno": return (
        <g>
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.82} ${hy - r * 0.62} Q ${hx - r * 0.86} ${hy - r * 1.22} ${hx - r * 0.2} ${hy - r * 1.3} Q ${hx + r * 0.55} ${hy - r * 1.5} ${hx + r * 0.62} ${hy - r * 1.84} Q ${hx + r * 0.95} ${hy - r * 1.3} ${hx + r * 0.84} ${hy - r * 0.62} Q ${hx} ${hy - r * 0.8} ${hx - r * 0.82} ${hy - r * 0.62} Z`} brillo />
          <path d={`M ${hx - r * 0.84} ${hy - r * 0.7} Q ${hx} ${hy - r * 0.88} ${hx + r * 0.86} ${hy - r * 0.7}`} stroke="#f4efe3" strokeWidth={r * 0.12} fill="none" />
        </g>
      );
      case "piel": return (
        // el gorro mongol: copa redonda de tela y un ala gruesa de piel con mechones
        <g>
          <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.72} ${hy - r * 0.7} Q ${hx - r * 0.78} ${hy - r * 1.5} ${hx} ${hy - r * 1.56} Q ${hx + r * 0.78} ${hy - r * 1.5} ${hx + r * 0.72} ${hy - r * 0.7} Z`} />
          <Forma tema={tema} fill="#7a5638" d={`M ${hx - r * 1.1} ${hy - r * 0.42} Q ${hx - r * 1.14} ${hy - r * 0.92} ${hx - r * 0.6} ${hy - r * 0.92} Q ${hx} ${hy - r * 1.04} ${hx + r * 0.6} ${hy - r * 0.92} Q ${hx + r * 1.14} ${hy - r * 0.92} ${hx + r * 1.1} ${hy - r * 0.42} Q ${hx} ${hy - r * 0.62} ${hx - r * 1.1} ${hy - r * 0.42} Z`} />
          {[-0.75, -0.35, 0.05, 0.45, 0.85].map((k) => <path key={k} d={`M ${hx + r * k} ${hy - r * 0.6} l ${r * 0.08} ${-r * 0.22}`} stroke={tono("#7a5638", 0.35)} strokeWidth={r * 0.06} strokeLinecap="round" />)}
          <circle cx={hx} cy={hy - r * 1.6} r={r * 0.1} fill="#e8b74a" stroke={tema.tinta} strokeWidth={tema.trazo * 0.7} />
        </g>
      );
      case "laurel": {
        // corona de laurel: dos ramas de hojas que se juntan delante (emperadores romanos, vencedores griegos)
        const hoja = tr.sombreroColor ?? "#4f8f3a";
        const p0 = [hx - r * 0.98, hy - r * 0.38], p1 = [hx, hy - r * 1.18], p2 = [hx + r * 0.98, hy - r * 0.38];
        const en = (t: number) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
        return (
          <g>
            <path d={`M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} stroke={tono(hoja, -0.3)} strokeWidth={r * 0.06} fill="none" />
            {Array.from({ length: 11 }).map((_, i) => {
              const t = 0.04 + i * 0.092, [x, y] = en(t), [x2, y2] = en(t + 0.01);
              const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
              return [-1, 1].map((l) => <ellipse key={`${i}${l}`} cx={x} cy={y} rx={r * 0.15} ry={r * 0.065} transform={`rotate(${ang + l * 38 + (i < 5.5 ? 180 : 0)}, ${x}, ${y}) translate(${r * 0.11}, 0)`} fill={hoja} stroke={tema.tinta} strokeWidth={tema.trazo * 0.55} />);
            })}
          </g>
        );
      }
      case "nemes": {
        // el tocado del faraón: rayas oro y azul, dos faldones hasta los hombros y la cobra en la frente
        const oro = tr.sombreroColor ?? "#e8b74a", azul = "#2f4f8f";
        const gorro = `M ${hx - r * 1.08} ${hy - r * 0.28} Q ${hx - r * 1.12} ${hy - r * 1.24} ${hx} ${hy - r * 1.28} Q ${hx + r * 1.12} ${hy - r * 1.24} ${hx + r * 1.08} ${hy - r * 0.28} L ${hx + r * 0.86} ${hy - r * 0.28} Q ${hx + r * 0.8} ${hy - r * 0.6} ${hx} ${hy - r * 0.64} Q ${hx - r * 0.8} ${hy - r * 0.6} ${hx - r * 0.86} ${hy - r * 0.28} Z`;
        const faldon = (l: number) => `M ${hx + l * r * 0.8} ${hy - r * 0.32} L ${hx + l * r * 1.12} ${hy - r * 0.32} L ${hx + l * r * 1.22} ${hy + r * 1.24} L ${hx + l * r * 0.74} ${hy + r * 1.24} Z`;
        return (
          <g>
            <defs><clipPath id={`nemes${uid}`}><path d={`${gorro} ${faldon(-1)} ${faldon(1)}`} /></clipPath></defs>
            {[-1, 1].map((l) => <Forma key={l} tema={tema} fill={oro} d={faldon(l)} />)}
            <Forma tema={tema} fill={oro} d={gorro} />
            <g clipPath={`url(#nemes${uid})`}>
              {Array.from({ length: 9 }).map((_, i) => <rect key={`f${i}`} x={hx - r * 1.3} y={hy - r * 0.2 + i * r * 0.16} width={r * 2.6} height={r * 0.07} fill={azul} />)}
              {Array.from({ length: 6 }).map((_, i) => <path key={`g${i}`} d={`M ${hx - r * 1.2} ${hy - r * (0.42 + i * 0.15)} Q ${hx} ${hy - r * (0.98 + i * 0.15)} ${hx + r * 1.2} ${hy - r * (0.42 + i * 0.15)}`} stroke={azul} strokeWidth={r * 0.07} fill="none" />)}
            </g>
            {[-1, 1].map((l) => <path key={`b${l}`} d={faldon(l)} fill="none" stroke={tema.tinta} strokeWidth={Math.max(2, tema.trazo)} strokeLinejoin="round" />)}
            <path d={gorro} fill="none" stroke={tema.tinta} strokeWidth={Math.max(2, tema.trazo)} strokeLinejoin="round" />
            <path d={`M ${hx - r * 0.86} ${hy - r * 0.3} Q ${hx - r * 0.8} ${hy - r * 0.6} ${hx} ${hy - r * 0.64} Q ${hx + r * 0.8} ${hy - r * 0.6} ${hx + r * 0.86} ${hy - r * 0.3}`} stroke={oro} strokeWidth={r * 0.1} fill="none" />
            <Forma tema={tema} fill="#f0c23b" d={`M ${hx} ${hy - r * 0.6} Q ${hx - r * 0.13} ${hy - r * 0.78} ${hx} ${hy - r * 0.94} Q ${hx + r * 0.13} ${hy - r * 0.78} ${hx} ${hy - r * 0.6} Z`} grosor={0.6} />
            <circle cx={hx} cy={hy - r * 0.8} r={r * 0.04} fill="#2fa35a" />
          </g>
        );
      }
      case "plumas": {
        // penacho de plumas largas de colores sobre una cinta (mexicas, mayas; también el tocado de los nativos)
        const cols = ["#2fa35a", "#d8322a", "#3c7fd0", "#f2c230", "#2fa35a", "#d8322a", "#3c7fd0"];
        const bx = hx, by = hy - r * 0.72;
        return (
          <g>
            {cols.map((c, i) => {
              const ang = -63 + i * 21;
              return (
                <g key={i} transform={`rotate(${ang}, ${bx}, ${by})`}>
                  <Forma tema={tema} fill={c} d={`M ${bx} ${by} Q ${bx - r * 0.17} ${by - r * 0.75} ${bx} ${by - r * 1.42} Q ${bx + r * 0.17} ${by - r * 0.75} ${bx} ${by} Z`} grosor={0.6} />
                  <path d={`M ${bx} ${by - r * 0.1} L ${bx} ${by - r * 1.3}`} stroke={tono(c, 0.35)} strokeWidth={r * 0.035} />
                </g>
              );
            })}
            <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.98} ${hy - r * 0.38} Q ${hx} ${hy - r * 0.86} ${hx + r * 0.98} ${hy - r * 0.38} L ${hx + r * 0.94} ${hy - r * 0.58} Q ${hx} ${hy - r * 1.04} ${hx - r * 0.94} ${hy - r * 0.58} Z`} />
            {[-0.55, 0, 0.55].map((k) => <circle key={k} cx={hx + r * k} cy={hy - r * (0.66 - Math.abs(k) * 0.28) - r * 0.07} r={r * 0.07} fill="#f2c230" stroke={tema.tinta} strokeWidth={tema.trazo * 0.5} />)}
          </g>
        );
      }
      case "kabuto": {
        // casco de samurái: copa lacada, cubrenuca en láminas que se abre a los lados y la media luna dorada delante
        const laca = sc === "#6b4a2e" ? "#26201c" : sc;
        return (
          <g>
            {[-1, 1].map((l) => (
              <g key={l}>
                <Forma tema={tema} fill={laca} d={`M ${hx + l * r * 0.9} ${hy - r * 0.68} L ${hx + l * r * 1.5} ${hy - r * 0.02} L ${hx + l * r * 1.3} ${hy + r * 0.14} L ${hx + l * r * 0.84} ${hy - r * 0.26} Z`} />
                {[0.25, 0.5, 0.75].map((k) => <path key={k} d={`M ${hx + l * r * (0.88 + k * 0.03)} ${hy - r * (0.68 - k * 0.42)} L ${hx + l * r * (0.9 + k * 0.6)} ${hy - r * (0.68 - k * 0.42) + r * 0.0 + r * k * 0.22}`} stroke="#c8322b" strokeWidth={r * 0.05} />)}
              </g>
            ))}
            <Forma tema={tema} fill={laca} d={`M ${hx - r * 0.98} ${hy - r * 0.5} Q ${hx - r * 1.04} ${hy - r * 1.36} ${hx} ${hy - r * 1.4} Q ${hx + r * 1.04} ${hy - r * 1.36} ${hx + r * 0.98} ${hy - r * 0.5} Z`} brillo />
            {[-0.5, 0, 0.5].map((k) => <path key={k} d={`M ${hx + r * k * 1.2} ${hy - r * 0.58} Q ${hx + r * k * 0.9} ${hy - r * 1.1} ${hx + r * k * 0.3} ${hy - r * 1.38}`} stroke={tono(laca, 0.35)} strokeWidth={r * 0.04} fill="none" />)}
            <Forma tema={tema} fill={tono(laca, 0.15)} d={`M ${hx - r * 1.04} ${hy - r * 0.5} Q ${hx} ${hy - r * 0.76} ${hx + r * 1.04} ${hy - r * 0.5} L ${hx + r * 0.98} ${hy - r * 0.62} Q ${hx} ${hy - r * 0.88} ${hx - r * 0.98} ${hy - r * 0.62} Z`} grosor={0.7} />
            <Forma tema={tema} fill="#f0c23b" d={`M ${hx} ${hy - r * 0.8} Q ${hx - r * 0.52} ${hy - r * 0.86} ${hx - r * 0.78} ${hy - r * 1.72} Q ${hx - r * 0.36} ${hy - r * 1.1} ${hx} ${hy - r * 1.0} Q ${hx + r * 0.36} ${hy - r * 1.1} ${hx + r * 0.78} ${hy - r * 1.72} Q ${hx + r * 0.52} ${hy - r * 0.86} ${hx} ${hy - r * 0.8} Z`} brillo />
          </g>
        );
      }
      case "conico": {
        // sombrero cónico de paja (China, Japón, Vietnam)
        const paja = sc === "#6b4a2e" ? "#d9b26a" : sc;
        return (
          <g>
            <Forma tema={tema} fill={paja} d={`M ${hx - r * 1.6} ${hy - r * 0.5} L ${hx} ${hy - r * 1.5} L ${hx + r * 1.6} ${hy - r * 0.5} Q ${hx} ${hy - r * 0.3} ${hx - r * 1.6} ${hy - r * 0.5} Z`} />
            {[-1.15, -0.65, -0.2, 0.2, 0.65, 1.15].map((k) => <path key={k} d={`M ${hx} ${hy - r * 1.46} L ${hx + r * k} ${hy - r * (0.42 + Math.abs(k) * 0.02)}`} stroke={tono(paja, -0.25)} strokeWidth={r * 0.03} />)}
            <path d={`M ${hx - r * 1.05} ${hy - r * 0.82} Q ${hx} ${hy - r * 0.64} ${hx + r * 1.05} ${hy - r * 0.82}`} stroke={tono(paja, -0.3)} strokeWidth={r * 0.04} fill="none" />
          </g>
        );
      }
      case "frigio": {
        // el gorro frigio rojo de la Revolución francesa: la punta cae hacia el lado al que mira, y la escarapela
        const rojo = sc === "#6b4a2e" ? "#c8322b" : sc;
        const l = mira < 0 ? -1 : 1;
        const X = (k: number) => hx + l * r * k, Y = (k: number) => hy + r * k;
        return (
          <g>
            <Forma tema={tema} fill={rojo} d={`M ${X(-0.96)} ${Y(-0.46)} Q ${X(-1.06)} ${Y(-1.25)} ${X(-0.3)} ${Y(-1.5)} Q ${X(0.45)} ${Y(-1.72)} ${X(0.95)} ${Y(-1.25)} Q ${X(1.26)} ${Y(-0.95)} ${X(1.1)} ${Y(-0.66)} Q ${X(0.98)} ${Y(-0.58)} ${X(0.9)} ${Y(-0.76)} Q ${X(0.96)} ${Y(-0.6)} ${X(0.96)} ${Y(-0.46)} Q ${X(0)} ${Y(-0.66)} ${X(-0.96)} ${Y(-0.46)} Z`} />
            <path d={`M ${X(-0.96)} ${Y(-0.56)} Q ${X(0)} ${Y(-0.76)} ${X(0.96)} ${Y(-0.56)}`} stroke={tono(rojo, -0.3)} strokeWidth={r * 0.06} fill="none" />
            <path d={`M ${X(-0.2)} ${Y(-1.45)} Q ${X(0.5)} ${Y(-1.3)} ${X(0.9)} ${Y(-0.9)}`} stroke={tono(rojo, -0.25)} strokeWidth={r * 0.04} fill="none" />
            <circle cx={X(-0.6)} cy={Y(-0.84)} r={r * 0.16} fill="#2c4a8a" stroke={tema.tinta} strokeWidth={tema.trazo * 0.6} />
            <circle cx={X(-0.6)} cy={Y(-0.84)} r={r * 0.1} fill="#f4efe3" />
            <circle cx={X(-0.6)} cy={Y(-0.84)} r={r * 0.045} fill="#c8322b" />
          </g>
        );
      }
      case "gorra": {
        // la gorra plana de los obreros (siglos XIX-XX), con la visera corta delante
        const v = hx + mira * r * 0.15;
        return (
          <g>
            <Forma tema={tema} fill={sc} d={`M ${hx - r * 1.02} ${hy - r * 0.56} Q ${hx - r * 1.12} ${hy - r * 1.1} ${hx - r * 0.1} ${hy - r * 1.16} Q ${hx + r * 1.12} ${hy - r * 1.12} ${hx + r * 1.02} ${hy - r * 0.56} Z`} />
            <path d={`M ${hx - r * 0.2} ${hy - r * 1.14} Q ${hx + r * 0.2} ${hy - r * 0.85} ${hx + r * 0.1} ${hy - r * 0.58}`} stroke={tono(sc, -0.3)} strokeWidth={r * 0.04} fill="none" />
            <Forma tema={tema} fill={tono(sc, -0.25)} d={`M ${v - r * 0.92} ${hy - r * 0.56} Q ${v} ${hy - r * 0.36} ${v + r * 0.92} ${hy - r * 0.56} Q ${v} ${hy - r * 0.66} ${v - r * 0.92} ${hy - r * 0.56} Z`} grosor={0.7} />
            <circle cx={hx - r * 0.1} cy={hy - r * 1.14} r={r * 0.07} fill={tono(sc, -0.2)} stroke={tema.tinta} strokeWidth={tema.trazo * 0.5} />
          </g>
        );
      }
      case "kepis": {
        // gorra de plato de oficial (siglos XIX-XX): copa ancha, cinta, visera negra y la insignia dorada
        const v = hx + mira * r * 0.12;
        return (
          <g>
            <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.9} ${hy - r * 0.8} Q ${hx - r * 1.32} ${hy - r * 1.22} ${hx - r * 0.6} ${hy - r * 1.34} Q ${hx} ${hy - r * 1.42} ${hx + r * 0.6} ${hy - r * 1.34} Q ${hx + r * 1.32} ${hy - r * 1.22} ${hx + r * 0.9} ${hy - r * 0.8} Z`} />
            <Forma tema={tema} fill="#7a1f2b" d={`M ${hx - r * 0.92} ${hy - r * 0.82} L ${hx + r * 0.92} ${hy - r * 0.82} L ${hx + r * 0.9} ${hy - r * 0.58} Q ${hx} ${hy - r * 0.66} ${hx - r * 0.9} ${hy - r * 0.58} Z`} grosor={0.7} />
            <Forma tema={tema} fill="#1d1c1a" d={`M ${v - r * 0.86} ${hy - r * 0.6} Q ${v} ${hy - r * 0.32} ${v + r * 0.86} ${hy - r * 0.6} Q ${v} ${hy - r * 0.68} ${v - r * 0.86} ${hy - r * 0.6} Z`} grosor={0.7} brillo />
            <Forma tema={tema} fill="#f0c23b" d={`M ${hx} ${hy - r * 1.18} L ${hx + r * 0.14} ${hy - r * 1.0} L ${hx} ${hy - r * 0.84} L ${hx - r * 0.14} ${hy - r * 1.0} Z`} grosor={0.6} />
          </g>
        );
      }
      case "tricornio": {
        // el tricornio del siglo XVIII: ala levantada en tres picos, uno delante, con ribete dorado
        const borde = `M ${hx - r * 1.24} ${hy - r * 0.74} Q ${hx - r * 1.08} ${hy - r * 1.48} ${hx - r * 0.5} ${hy - r * 1.32} Q ${hx} ${hy - r * 1.14} ${hx + r * 0.5} ${hy - r * 1.32} Q ${hx + r * 1.08} ${hy - r * 1.48} ${hx + r * 1.24} ${hy - r * 0.74}`;
        return (
          <g>
            <Forma tema={tema} fill={tono(sc, -0.15)} d={`M ${hx - r * 0.66} ${hy - r * 0.9} Q ${hx} ${hy - r * 1.62} ${hx + r * 0.66} ${hy - r * 0.9} Z`} grosor={0.7} />
            <Forma tema={tema} fill={sc} d={`${borde} L ${hx} ${hy - r * 0.46} Z`} />
            <path d={borde} stroke="#e8b74a" strokeWidth={r * 0.07} fill="none" />
            <circle cx={hx + r * 0.62} cy={hy - r * 0.92} r={r * 0.1} fill="#26201c" stroke="#e8b74a" strokeWidth={r * 0.03} />
          </g>
        );
      }
      case "casco_griego": {
        // casco corintio de bronce, con la cara al aire, carrilleras a los lados y la cresta roja de crin
        const bronce = sc === "#6b4a2e" ? "#c9a24a" : sc;
        return (
          <g>
            <Forma tema={tema} fill="#b5262b" d={`M ${hx - r * 0.16} ${hy - r * 1.24} Q ${hx - r * 1.0} ${hy - r * 1.9} ${hx} ${hy - r * 2.34} Q ${hx + r * 1.0} ${hy - r * 1.9} ${hx + r * 0.16} ${hy - r * 1.24} Z`} />
            {[-0.6, -0.3, 0, 0.3, 0.6].map((k) => <path key={k} d={`M ${hx + r * k * 0.25} ${hy - r * 1.4} L ${hx + r * k * 1.15} ${hy - r * (2.15 - Math.abs(k) * 0.35)}`} stroke={tono("#b5262b", -0.3)} strokeWidth={r * 0.035} />)}
            <Forma tema={tema} fill={bronce} d={`M ${hx - r * 1.0} ${hy - r * 0.3} Q ${hx - r * 1.06} ${hy - r * 1.32} ${hx} ${hy - r * 1.36} Q ${hx + r * 1.06} ${hy - r * 1.32} ${hx + r * 1.0} ${hy - r * 0.3} L ${hx + r * 0.84} ${hy + r * 0.3} L ${hx + r * 0.64} ${hy + r * 0.24} Q ${hx + r * 0.72} ${hy - r * 0.42} ${hx} ${hy - r * 0.5} Q ${hx - r * 0.72} ${hy - r * 0.42} ${hx - r * 0.64} ${hy + r * 0.24} L ${hx - r * 0.84} ${hy + r * 0.3} Z`} brillo />
            <path d={`M ${hx - r * 0.7} ${hy - r * 0.5} Q ${hx} ${hy - r * 0.62} ${hx + r * 0.7} ${hy - r * 0.5}`} stroke={tono(bronce, -0.3)} strokeWidth={r * 0.05} fill="none" />
            <Forma tema={tema} fill={tono(bronce, -0.1)} x={hx - r * 0.08} y={hy - r * 1.42} w={r * 0.16} h={r * 0.16} esq={2} grosor={0.5} />
          </g>
        );
      }
      case "fez": {
        // el fez rojo con borla negra (Imperio otomano, siglo XIX)
        const rojo = sc === "#6b4a2e" ? "#b5262b" : sc;
        const l = mira < 0 ? -1 : 1;
        return (
          <g>
            <Forma tema={tema} fill={rojo} d={`M ${hx - r * 0.62} ${hy - r * 0.74} L ${hx - r * 0.5} ${hy - r * 1.44} L ${hx + r * 0.5} ${hy - r * 1.44} L ${hx + r * 0.62} ${hy - r * 0.74} Q ${hx} ${hy - r * 0.62} ${hx - r * 0.62} ${hy - r * 0.74} Z`} />
            <Forma tema={tema} fill={tono(rojo, -0.2)} rx={r * 0.5} ry={r * 0.09} cx={hx} cy={hy - r * 1.44} grosor={0.6} />
            <path d={`M ${hx} ${hy - r * 1.46} Q ${hx + l * r * 0.4} ${hy - r * 1.5} ${hx + l * r * 0.62} ${hy - r * 1.12}`} stroke="#1d1c1a" strokeWidth={r * 0.05} fill="none" />
            {[-0.06, 0, 0.06].map((k) => <path key={k} d={`M ${hx + l * r * 0.62} ${hy - r * 1.14} l ${l * r * k} ${r * 0.28}`} stroke="#1d1c1a" strokeWidth={r * 0.05} strokeLinecap="round" />)}
          </g>
        );
      }
      case "mitra": return <Forma tema={tema} fill={sc} d={`M ${hx - r * 0.6} ${hy - r * 0.75} L ${hx - r * 0.45} ${hy - r * 1.6} L ${hx} ${hy - r * 1.9} L ${hx + r * 0.45} ${hy - r * 1.6} L ${hx + r * 0.6} ${hy - r * 0.75} Z`} />;
      default: return null;
    }
  };
  const Sombrero = quitado ? null : dibSombrero(hx, hy);
  const enLaMano = quitado && tr.sombrero && tr.sombrero !== "ninguno" ? <g transform="rotate(-25)">{dibSombrero(0, r * 1.1)}</g> : lleva;

  const Mano: React.FC<{ p: [number, number] }> = ({ p }) =>
    tema.dibujo === "plano" || tema.dibujo === "tinta"
      ? <circle cx={p[0]} cy={p[1]} r={tema.palito * 0.9} fill={tinta} />
      : <Forma tema={tema} fill={tema.piel} cx={p[0]} cy={p[1]} r={tema.palito * 0.85} grosor={0.7} />;

  const enMano = (b: ReturnType<typeof brazo>, obj?: React.ReactNode) =>
    obj ? <g transform={`translate(${b.mano[0]}, ${b.mano[1]}) rotate(${b.ang * 0.25})`}>{obj}</g> : null;

  const papel = tema.dibujo === "papel";
  return (
    <g transform={`translate(0, ${-pose.salto}) rotate(${pose.tronco * 0.4}) scale(${1 + pose.aplasta * 0.08}, ${1 - pose.aplasta * 0.1})`} filter={papel ? "url(#t-papel)" : undefined}>
      {/* sombra en el suelo */}
      {!papel && !montado && <ellipse cx={0} cy={2} rx={46 + m.anchoB * 0.3} ry={9} fill="#000" opacity={0.13} />}
      {tr.capa && <Forma tema={tema} fill={tr.capa} d={`M ${-wH - 4} ${hom + 4} L ${wH + 4} ${hom + 4} L ${wB + 26} ${largoCapa} L ${-wB - 26} ${largoCapa} Z`} />}
      {PeloDetras}
      <Linea tema={tema} pts={pierna(-1)} color={piernaColor} />
      <Linea tema={tema} pts={pierna(1)} color={piernaColor} />
      {/* zapatos */}
      {[-1, 1].map((l) => { const p = pierna(l); const [x, y] = p[p.length - 1]; return <Forma key={l} tema={tema} fill={tema.dibujo === "plano" || tema.dibujo === "tinta" ? tinta : "#3b2a1e"} rx={tema.palito * 1.5 + 4} ry={tema.palito * 0.8 + 2} cx={x + l * 4 + mira * 5} cy={y - 2} grosor={0.6} />; })}
      <Linea tema={tema} pts={bI.pts} color={manga} />
      <Mano p={bI.mano} />
      {enMano(bI, llevaI)}
      <Forma tema={tema} fill={tr.color} d={cuerpo} />
      {/* cuello en pico y cinturón: detalle de ropa como en la referencia */}
      {(tr.forma === "tunica" || tr.forma === "vestido" || tr.forma === "habito") && (
        <path d={`M ${-wH * 0.32} ${hom - 3} L 0 ${hom + 16} L ${wH * 0.32} ${hom - 3}`} fill="none" stroke={tono(tr.color, -0.35)} strokeWidth={tema.dibujo === "cabezon" ? 5 : 3} strokeLinejoin="round" />
      )}
      {(tr.forma === "tunica" || tr.forma === "habito" || tr.forma === "casaca") && (() => {
        const yb = tr.forma === "casaca" ? hom + (hem - hom) * 0.58 : cad - 8;
        const k = (yb - hom) / Math.max(1, hem - hom);
        const w = wH + (wB - wH) * k;
        return <Forma tema={tema} fill={tr.forma === "habito" ? "#d9c89a" : tono(tr.color, -0.45)} x={-w + 2} y={yb - 5} w={2 * w - 4} h={tr.forma === "habito" ? 7 : 10} esq={3} grosor={0.5} />;
      })()}
      {tr.forma === "vestido" && <Forma tema={tema} fill={tr.ribete ?? tono(tr.color, -0.4)} x={-wH * 0.92} y={hom + 44} w={wH * 1.84} h={9} esq={3} grosor={0.5} />}
      {tr.forma === "chaleco" && (
        <g>
          <Forma tema={tema} fill={tr.ribete ?? "#f4efe3"} d={`M ${-wH * 0.42} ${hom - 3} L ${wH * 0.42} ${hom - 3} L ${wH * 0.25} ${hem - 4} L ${-wH * 0.25} ${hem - 4} Z`} grosor={0.6} />
          <circle cx={-wH * 0.62} cy={(hom + hem) / 2 + 6} r={4} fill={tinta} opacity={0.7} />
        </g>
      )}
      {tr.forma === "casaca" && <path d={`M 0 ${hom - 2} L 0 ${hem - 2} M -6 ${hom + 22} L 6 ${hom + 22} M -6 ${hom + 44} L 6 ${hom + 44}`} stroke={tr.ribete ?? tinta} strokeWidth={3} strokeLinecap="round" />}
      {tr.forma === "armadura" && <path d={`M ${-wH + 6} ${hom + 30} Q 0 ${hom + 40} ${wH - 6} ${hom + 30} M ${-wB + 8} ${cad - 6} Q 0 ${cad + 4} ${wB - 8} ${cad - 6}`} stroke={tr.ribete ?? tinta} strokeWidth={3} fill="none" />}
      {tr.ribete && (tr.forma === "vestido" || tr.forma === "tunica") && <path d={`M ${-wB + 3} ${hem - 6} Q 0 ${hem} ${wB - 3} ${hem - 6}`} stroke={tr.ribete} strokeWidth={tema.dibujo === "cabezon" ? 9 : 6} fill="none" strokeLinecap="round" />}
      {tr.gorguera && <Forma tema={tema} fill="#f7f4ec" d={`M ${-wH * 0.95} ${hom - 4} Q ${-wH * 0.6} ${hom - 24} 0 ${hom - 22} Q ${wH * 0.6} ${hom - 24} ${wH * 0.95} ${hom - 4} Q ${wH * 0.6} ${hom + 12} 0 ${hom + 10} Q ${-wH * 0.6} ${hom + 12} ${-wH * 0.95} ${hom - 4} Z`} grosor={0.7} />}
      {tr.panuelo && (
        <g>
          <Forma tema={tema} fill={tr.panuelo} d={`M ${-wH * 0.95} ${hom - 8} Q 0 ${hom + 6} ${wH * 0.95} ${hom - 8} L ${wH * 0.5} ${hom + 12} L ${mira * 8} ${hom + 48} L ${-wH * 0.5} ${hom + 12} Z`} grosor={0.8} />
          <Forma tema={tema} fill={tr.panuelo} d={`M ${wH * 0.35} ${hom + 2} L ${wH * 0.95} ${hom + 34} L ${wH * 0.62} ${hom + 40} Z`} grosor={0.7} />
          <Forma tema={tema} fill={tono(tr.panuelo, -0.15)} cx={wH * 0.32} cy={hom + 2} r={7} grosor={0.6} />
        </g>
      )}
      {/* cuello */}
      {tema.dibujo !== "cabezon" && <line x1={hx * 0.5} y1={hom - 2} x2={hx * 0.8} y2={hy + ry * 0.8} stroke={tinta} strokeWidth={tema.palito} strokeLinecap="round" />}
      {/* cabeza */}
      <Forma tema={tema} fill={tema.piel} sombra={tema.pielSombra} cx={hx} cy={hy} {...(ry !== r ? { rx: r, ry } : { r })} brillo />
      {Barba}
      {PeloDelante}
      <Ojo x={fx - ojoSep} />
      <Ojo x={fx + ojoSep} />
      {ojosAhora === "enfado" && <path d={`M ${fx - ojoSep - r * 0.14} ${ojoY - r * 0.22} L ${fx - ojoSep + r * 0.12} ${ojoY - r * 0.12} M ${fx + ojoSep + r * 0.14} ${ojoY - r * 0.22} L ${fx + ojoSep - r * 0.12} ${ojoY - r * 0.12}`} stroke={tinta} strokeWidth={Math.max(2.5, r * 0.05)} strokeLinecap="round" />}
      {tr.gafas && (
        <g fill="none" stroke={tinta} strokeWidth={Math.max(2.4, r * 0.045)}>
          <circle cx={fx - ojoSep} cy={ojoY} r={r * 0.21} />
          <circle cx={fx + ojoSep} cy={ojoY} r={r * 0.21} />
          <path d={`M ${fx - ojoSep + r * 0.21} ${ojoY} L ${fx + ojoSep - r * 0.21} ${ojoY}`} />
        </g>
      )}
      {Bocas[bocaAhora]}
      {Bigote}
      {tr.coronita && <Forma tema={tema} fill="#f0c23b" d={`M ${hx - r * 0.34} ${hy - r * 1.02} L ${hx - r * 0.38} ${hy - r * 1.36} L ${hx - r * 0.17} ${hy - r * 1.18} L ${hx} ${hy - r * 1.42} L ${hx + r * 0.17} ${hy - r * 1.18} L ${hx + r * 0.38} ${hy - r * 1.36} L ${hx + r * 0.34} ${hy - r * 1.02} Z`} grosor={0.6} />}
      {Sombrero}
      <Linea tema={tema} pts={bD.pts} color={manga} />
      {enMano(bD, enLaMano)}
      <Mano p={bD.mano} />
    </g>
  );
};
