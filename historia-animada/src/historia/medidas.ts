// Las medidas del mundo de la plantilla (11-11-2026: «que el tamaño de edificios sea medidas que tengan sentido
// obvio»). Antes un muñeco medía lo mismo que dos pisos o que una tienda de campaña y un barco era como una persona.
// Ahora todo se mide en PERSONAS y los edificios están en la misma línea que los pies de los muñecos (sin perspectiva
// que haya que adivinar):
//  - una puerta mide 1,25 personas; la planta baja, 1,55; cada piso de arriba, 1,35; una ventana, 0,55;
//  - una tienda de campaña, 1,5 personas (su puerta, 1,1);
//  - una carabela o una galera, 3 personas de alto.
// En los decorados con edificios delante, los muñecos van un poco más pequeños (GENTE) para que quepan una puerta y un
// piso encima; en el resto (campo, desierto, mar, sala del trono…) siguen a su tamaño.

/** Lo que mide de alto un muñeco de pie con «s»: 1 (de los pies a lo alto de la cabeza, sin sombrero). */
export const PERSONA = 360; // medido en las fotos: unos 350-360 px de los pies al pelo

/** Tamaño de los muñecos en cada decorado (1 = el de siempre). */
export const GENTE: Record<string, number> = {
  ciudad: 0.72, calle: 0.72, canales: 0.72, fabrica: 0.72, palacio: 0.8, foro: 0.8, interior: 0.85, puerto: 0.8,
};

/** Una persona en píxeles en ese decorado. */
export const P = (deco: string) => PERSONA * (GENTE[deco] ?? 1);

export const MEDIDA = { puerta: 1.25, bajo: 1.55, piso: 1.35, ventana: 0.55, tienda: 1.5, barco: 3 };

/** Lo que mide de alto cada cosa del catálogo cuando sale en una ESCENA, en personas (11-11-2026: «a veces las
 *  casas / animales son demasiado pequeños»: una choza salía como una oveja y un camello cabía en la mano). Las que no
 *  están aquí son símbolos (corona, cruz, pergamino, monedas…) y salen al tamaño que diga el plan. La caja de cada
 *  dibujo está medida en cajas-cosas.json (node herramientas/medir_cosas.mjs). */
export const REAL: Record<string, number> = {
  // animales
  oveja: 0.45, camello: 1.15, vaca: 0.8, caballo: 1.0, elefante: 1.9, loba: 0.5, rata: 0.08,
  // gente pequeña y cosas de suelo
  bebe: 0.25, cesta: 0.22, barril: 0.45, saco: 0.4, trigo: 0.55, sal: 0.4, especias: 0.3, seda: 0.3,
  // casas y sitios (la choza con su humo)
  choza: 2.0, yurta: 1.3, muralla: 2.6, templo: 3.2, pagoda: 4, fabrica: 4, castillo: 4.2, piramide: 5, petroleo: 5,
  // máquinas y barcos
  carabela: 3, galera: 2.6, junco: 2.8, barco_vapor: 3, tren: 1.9, catapulta: 1.4, canon: 0.6, tanque: 1.2, avion: 0.9, acorazado: 2.6, portaaviones: 2.6, submarino: 1.0, radar: 4,
};
/** Más alto que esto no cabe: lo que se pasaría, se queda en 900 px (como si estuviera un poco más lejos). */
export const ALTO_MAX = 900;
