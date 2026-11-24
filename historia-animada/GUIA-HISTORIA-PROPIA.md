# Guía para hacer una historia (para Claude)

Esta guía es para ti, Claude: cómo convertir cualquier tema de historia («la historia entera de Egipto», «por qué cayó
Roma») en un vídeo de **8 a 12 minutos** con el estilo de la plantilla: mapas de satélite con territorios de colores,
el cronista (la mascota) que lo cuenta sobre fondo gris, escenas con muñecos que dialogan y retratos de verdad.
Las 3 historias de serie (`Historias/1`, `2` y `3`) están hechas así: **ábrelas y cópialas** cuando dudes.

Al usuario háblale en español llano. Él no ve nada de esto: tú haces el trabajo y le cuentas en una línea por paso
lo que estás haciendo.

## 1. Los pasos

1. `historia nueva "Título"` → crea `Historias/N - Título/` con `guion.txt` y `ficha.json` vacíos.
2. **Investiga** el tema (búsqueda web si la tienes; si no, lo que sabes con seguridad). Fechas, cifras y nombres
   tienen que ser verdad: si dudas de un dato, no lo pongas.
3. **Escribe `guion.txt`** (apartado 2) y enséñaselo al usuario para que dé el visto bueno antes de seguir.
4. **Escribe `ficha.json`** (título, descripción y los mapas que harán falta) y prepara los mapas: `historia mapas N`.
5. **Escribe `plan.json`** (apartados 3 a 6), anclado a palabras del guion.
6. El usuario hace la voz (CLAUDE.md, paso «La voz») y tú la preparas: `historia voz N`.
7. `historia revisar N` → arregla todos los `AVISO` (necesita la voz: hasta entonces no puede comprobar tiempos).
8. `historia fotos N` → **mira todas las hojas** (apartado 7) y arregla lo que se vea mal. Repite hasta que esté bien.
9. `historia montar N` → el vídeo y su `.txt` quedan en «Vídeos listos».

## 2. El guion (`guion.txt`)

- **1.200-1.600 palabras** (8-11 minutos de voz). Solo el texto que se lee: párrafos separados por una línea en
  blanco, sin títulos, sin corchetes, sin acotaciones. Lo que pongas aquí es exactamente lo que dirá la voz.
- **Estructura**:
  1. **Gancho (40-70 s)**: el dato rotundo del principio («En el año 793, unos barcos aparecieron…»), 3-4 momentos
     bestias de toda la historia contados muy rápido, la pregunta que el vídeo responde y un salto atrás a donde
     empieza todo. Termina con algo como «Esta es la historia entera de…».
  2. **5-7 capítulos** de 1-2 minutos cada uno, en orden. Cada uno empieza con una frase que lo sitúa (año y lugar).
  3. **Final (30-45 s)**: qué queda hoy de todo aquello y una frase de cierre con gancho.
- **Tono**: claro y con gracia, como contarlo a un amigo. Analogías modernas («era como si…»), algún momento de humor
  en cada capítulo, frases cortas. Lo oscuro (guerras, matanzas, esclavitud) en serio, sin chistes.
- **Que se pueda dibujar**: cada frase tiene que poder verse (un sitio en el mapa, un personaje haciendo algo, una
  cifra). Nombra lugares, años y personas concretas. Evita párrafos abstractos.
- **Números**: escríbelos como se dicen cuando son años («en 1035») y con cifras cortas; nada de abreviaturas raras
  (la voz las leería mal).

## 3. La ficha (`ficha.json`)

```json
{
  "titulo": "Los vikingos",
  "subir": "La historia ENTERA de los vikingos en {minutos} minutos",
  "descripcion": "Dos o tres frases para YouTube.",
  "tags": "#historia #vikingos #documental",
  "mapas": [
    ["--nombre", "mar-del-norte", "--zona", "-30", "77", "50", "38", "--grados-min", "14",
     "--paises", "SWE+DNK=escandinavia,DEU=alemania", "--regiones", "NOR:Svalbard=_,*=noruega", "--regiones", "GBR:England=inglaterra"]
  ]
}
```

Cada mapa es la lista de opciones de `herramientas/preparar_mapa.py` (ejecútalo con `--help` para ver todas):
- En `subir`, `{minutos}` se cambia solo por lo que dura el vídeo.
- `--zona` = longitud oeste, latitud norte, longitud este, latitud sur, **con mucho margen** (lo que se cuente tiene
  que caber con la mascota delante y la fecha arriba: si dudas, más grande).
- `--grados-min` = lo más que se acercará la cámara en ese mapa (los `grados` más pequeños de sus planos).
- `--paises ISO3=id` (países de hoy; `A+B=id` los junta), `--regiones "ISO3:Región+Región=id,*=id"` (provincias o
  naciones de hoy; `*` = el resto del país; un id que empieza por `_` se tira: así se quitan islas lejanas como
  Svalbard), `--hist AÑO:Nombre=id` (fronteras históricas de historical-basemaps; `--listar AÑO --zona …` enseña los
  nombres; son aproximadas: **míralas** y, si no cuadran con lo que dice la voz, usa chinchetas).
- **Años antes de Cristo**: en negativo (`"--hist", "-700:Assyria=asiria"`). Las fronteras antiguas son muy toscas y
  a veces no cubren lo que dice la voz (p. ej. el Imperio persa de -500 no incluye Egipto): complétalas con `--paises`
  de hoy con el mismo id.
- Un mismo id en varias opciones se junta en un solo territorio. Los mapas ya hechos están en `public/mapas/` y se
  reutilizan entre historias.
- `historia mapas N` se salta los mapas que ya existen. Si cambias la ficha de un mapa, **rehazlo**:
  `historia mapas N --rehacer nombre-del-mapa` (o `--rehacer` solo, para todos los de esa historia).
- Para ver cómo ha quedado un mapa, abre `public/mapas/<nombre>/` (la imagen de satélite y el `mapa.json` con los
  territorios). Si un territorio mete trozos que no tocan (un desierto enorme, una isla lejana), quítalos con `--regiones`.
- Haz las zonas **más grandes de lo que crees**: «no cabe en el mapa» es el aviso que más sale en las historias nuevas.
  Cuentan para «caber» las capas con `etiqueta` y las que aparecen después del principio del plano (`en` mayor que 0).

## 4. El plan (`plan.json`)

```json
{
  "cola": 1.5,
  "capitulos": ["793|Lindisfarne|cruz", "865|El Gran Ejército|espada", "911|Normandía|castillo"],
  "musica": [{ "desde": 0, "pista": "epica--call-to-adventure.mp3" }, { "desde": "Pero cuando", "pista": "triste--decline.mp3" }],
  "planos": [
    { "en": 0, "tipo": "mapa", "mapa": "mar-del-norte", "cam": { "lon": 1, "lat": 56, "grados": 22 }, "hasta": { "lon": 0, "lat": 55.5, "grados": 17 },
      "fecha": "793",
      "capas": [{ "en": "costa", "id": "inglaterra", "color": "rojo", "etiqueta": "Inglaterra", "cara": "susto", "cara_en": "Inglaterra" }],
      "barcos": [{ "en": "unos", "de": [6.5, 59.5], "a": [-1.2, 55.8], "d": 3.2, "flota": 3 }] }
  ]
}
```

- **`en`**: la palabra o frase de la voz donde empieza (sin importar tildes ni signos), o segundos. Cada plano busca su
  frase **después** del anterior; lo de dentro de un plano, dentro de su plano. Si una palabra se repite mucho, pon dos
  o tres seguidas («Pero cuando»). El plano dura hasta que empieza el siguiente.
- **`capitulos`**: `"año|título|icono"` (el icono, una cosa del catálogo). Salen en el pergamino.
- **`musica`**: una pieza por bloque grande (4-6 en un vídeo), desde su ancla. El motor la baja cuando habla la voz.
- **Ritmo**: en el gancho, **un plano cada ~3 s**; en el resto, uno cada ~4-5 s (un vídeo de 10 minutos son unos
  130-160 planos). Una escena con diálogo puede durar 10-20 s. Un mapa o un narrador, nunca más de 9 s seguidos.
  **Algo nuevo cada 1-2 s** dentro de cada plano (una chincheta, un territorio, una cara, un gesto).
- **Reparto aproximado**: escena 35 %, mapa 30 %, narrador 20 %, papel 5 %, archivo 6 %, capítulo 4 %.

## 5. Los tipos de plano

- **`mapa`**: `mapa`, `cam` y `hasta` (`lon`, `lat`, `grados` de longitud de lado a lado; la cámara viaja de una a
  otra), `fecha` (la cajita de arriba a la izquierda), y:
  - `capas`: territorios (`id`), `color` (`naranja`, `rojo`, `azul`, `verde`, `morado`, `amarillo`, `rosa`,
    `turquesa`, `marron`, `gris`, `granate`, `celeste` o `#hex`), `modo` (`aparece`, `crece` = se extiende como una
    conquista, `dibuja` = primero el borde), `etiqueta` (el nombre encima), `op`.
    **Sobre el mar, el azul y el celeste casi no se ven: usa rojo, naranja, amarillo o verde.**
  - **Países con cara**: en una capa, `"cara": "feliz" | "malo" | "enfado" | "susto" | "muerto"` (`muerto` = ojos en
    X), `"cara_en": "palabra"` (cuándo sale) y `"cara_lugar": [lon, lat]` si el centro del territorio queda fuera de
    cámara. El país pasa a ser un personaje: úsalo en los momentos fuertes (una invasión, una victoria, la muerte de un
    imperio), unas 6-10 veces por vídeo, no en todos los mapas.
  - **Territorio que se rompe**: `"rompe_en": "palabra"` en una capa → se parte en trozos de colores con rayas blancas
    (un reino que se divide, un imperio que se deshace). Con `cara: "muerto"` justo antes queda redondo.
  - **Foco**: `"foco": { "en": "palabra", "capa": "id" }` (o `"lon", "lat", "radio"`) oscurece todo el mapa menos esa
    zona. Para «aquí, en este rincón del mundo…».
  - **Comparar tamaños**: `"copias": [{ "en": "dos veces", "capa": "alemania", "puntos": [[9.5, 61.2], [21.5, 66.8]], "color": "amarillo" }]`
    copia la silueta de un territorio en esos puntos, numerada. El territorio copiado tiene que estar en el mapa.
  - **Barcos**: `"barcos": [{ "en", "de": [lon, lat], "a": [lon, lat], "d": 3, "flota": 3, "curva": 0.1, "color", "vela" }]`
    — una flota que navega dejando estela (`d` = segundos que tarda).
  - `ejercitos`: tropa con estandarte que marcha (`de`, `a`, `d`, `color`). `flechas` (`de`, `a`, `curva`,
    `puntos`), `pins` (chinchetas: `lon`, `lat`, `nombre`, `aro`, `izquierda`), `iconos` (una cosa del catálogo en un
    sitio: `lon`, `lat`, `cosa`, `tam`), `asedios`, `fuegos` (una ciudad que arde).
  - `guia`: la mascota abajo a la derecha. `{"lado": "izquierda"}` la cambia de lado; `{"no": true}` la quita (cuando
    tapa algo importante).
  - Un territorio no «se acuerda» del plano anterior: si debe seguir pintado, repítelo con `"en": 0`.
  - `"encuadre": false` deja la cámara exactamente como la pones (si no, el motor se aleja para que quepa todo).
- **`narrador`**: el fondo gris con el cronista a la izquierda y, a la derecha, `cosas` que saltan:
  `{"en", "palabra": "…", "rojo": true}`, `{"cifra": "1066", "sub": "…", "icono": "calavera"}`,
  `{"tarjeta": "Normandía", "cosa": "castillo"}`, `{"cosa": "corona", "pie": "…"}`, `{"imagen": "archivo/x.jpg", "pie": "…"}`.
  `"tachar": true` (o `"tachar_en": "palabra"`) le pone una cruz roja. Siempre tiene que saltar algo.
- **`escena`**: `decorado`, `noche`/`atardecer`, `tormenta`, `humo`, `actores` (`q` nombre, `traje`, `x`, `y`, `s`
  tamaño, `mira` −1…1, `sentado`, `montado`, `lleva`/`llevaI` una cosa, `colores`, `ojos`, `boca`,
  `acciones: [{"en", "hace": gesto}]`), `bocadillos` (`{"en", "a": q, "texto", "ancho"}`: **3-8 palabras, con gracia y
  sin repetir lo que dice la voz**), `cosas` que caen (`{"en", "cosa", "x", "y", "salta": -90}`), `rotulos` (la fecha:
  `{"en": 0, "tipo": "fecha", "texto": "Lindisfarne, 793"}`). Los muñecos pisan en `y` 900-1010; en la sala del trono
  los reyes sentados van en `x` 1210 y 1490, `y` 710. Una escena sin muñecos lleva `"paisaje": true`.
- **`archivo`**: `imagen` (de `Historias/N/archivo/`), `pie` y `modo` (`pantalla` = a pantalla completa con zoom
  lento; `tarjeta` = junto a la mascota, para retratos).
- **`papel`**: una hoja sobre el gris con `titulo` y `cosas` (esquemas, sumas, comparaciones).
- **`capitulo`**: `"numero": N` al empezar cada capítulo (dura 2-3 s). **`"numero": 0` = el pergamino con el camino
  entero**: ponlo una vez al final del gancho, cuando la voz dice de qué va el vídeo.
- En cualquier plano, `rotulos`: `{"en", "tipo": "fecha", "texto"}` o una palabra suelta `{"en", "texto", "x", "y", "tam", "rojo"}`.

## 6. El catálogo

- **Trajes**: `guia` (el cronista), `rey`, `reina`, `noble`, `campesino`, `campesina`, `mercader`, `monje`, `obispo`,
  `papa`, `caballero`, `cruzado`, `vikingo`, `visigodo`, `legionario`, `senador`, `cesar`, `romana`, `griego`,
  `filosofo`, `faraon`, `egipcio`, `egipcia`, `samurai`, `japones`, `emperador_chino`, `chino`, `chino_qing`, `mongol`,
  `mongola`, `tartaro`, `gengis`, `sultan`, `otomano`, `azteca`, `inca`, `indigena`, `conquistador`, `pirata`,
  `mosquetero`, `colono`, `revolucionario`, `napoleon`, `soldado_frances`, `obrero`, `general`, `soldado_1914`,
  `soldado_moderno`, `politico`, `ministro`, `banquero`, `minero`, `nino` (con `"s": 0.6`), `anciano`, `civil`,
  `civil_mujer`, y personajes: `isabel`, `fernando`, `colon`, `felipe2`, `isabel1`, `drake`, `reina_victoria`,
  `gandhi`, `churchill`, `stalin`, `hitler`, `mussolini`, `roosevelt`, `einstein`… `colores` en el actor cambia los
  colores del traje (`{"color": "#…", "capa": "#…", "sombreroColor": "#…"}`).
- **Cosas**: `corona`, `calavera`, `espada`, `escudo`, `arco`, `cruz`, `media_luna`, `castillo`, `muralla`, `templo`,
  `piramide`, `pagoda`, `choza`, `yurta`, `carabela`, `galera`, `junco`, `barco_vapor`, `ancla`, `moneda`,
  `monton_monedas`, `lingote`, `oro`, `saco`, `barril`, `trigo`, `pez`, `sal`, `especias`, `seda`, `caballo`, `camello`,
  `elefante`, `oveja`, `vaca`, `rata`, `loba`, `canon`, `fusil`, `catapulta`, `bomba`, `tanque`, `avion`, `fuego`,
  `pergamino`, `libro`, `pluma`, `mapa_abierto`, `mapa_enrollado`, `cadenas`, `balanza`, `reloj`, `bebe`, `cesta`,
  `bandera`, `bandera_blanca`, `bandera_inglaterra`, `bandera_uk`, `bandera_francia`, `bandera_japon`, `bandera_urss`,
  `fabrica`, `tren`, `petroleo`, `globo`, `sol`, `isla`, `islote`, `te`, `patata`, `diamante`, `azucar`, `tabaco`…
  **Ojo en las escenas**: los edificios (`piramide`, `castillo`, `templo`, `pagoda`, `muralla`, `choza`, `fabrica`…)
  salen a tamaño real al lado de los muñecos y tapan la escena. Úsalos en mapas (`iconos`), en el `narrador` o en el
  `papel`; en una escena, cuenta el sitio con el decorado y pon cosas pequeñas (oro, corona, herramientas).
- **Decorados**: `sala_trono`, `despacho`, `interior`, `campo` (castillo, valla, árboles), `ciudad` (con `"estilo":
  "oriente"` para Oriente Medio), `calle` (1880-1940), `puerto`, `mar` (`"barco": "galera"`, `"tormenta": true`),
  `canales`, `laguna`, `estepa`, `desierto`, `nieve`, `montana`, `rio`, `selva`, `foro` (Roma, Grecia), `calzada`,
  `palacio` (pagoda china: SOLO China y Japón; para Egipto, Persia o Europa usa `sala_trono`), `campamento`, `mina`,
  `fabrica`, `trinchera`.
- **Gestos** (`hace`): `senala` (`lado` −1/1), `encoge`, `piensa`, `asiente`, `niega`, `celebra`, `saluda`,
  `mira_camara`, `susto`, `jarras`, `rie`, `enfada`, `triste`, `orgulloso`, `camina` (`a`: x de destino), `entra`
  (`desde`), `sale` (`a`), `agacha`, `levanta`, `cae`, `ataca`, `quita_sombrero`. **Ojos**: `normal`, `felices`,
  `cerrados`, `susto`, `entornados`, `enfado`. **Bocas**: `linea`, `sonrisa`, `o`, `abierta`, `triste`.
- **Música** (`public/musica/`, Kevin MacLeod, CC BY 4.0: el crédito sale solo en el `.txt`): épica
  (`epica--call-to-adventure`, `epica--rising-tide`), medieval (`medieval--village-consort`,
  `medieval--lord-of-the-land`), antigua (`antigua--teller-of-the-tales`), barroco (`barroco--procession-of-the-king`),
  guerra (`guerra--crusade-heavy-industry`, `guerra--undaunted`, `guerra--impending-boom`), misterio (`misterio--hidden-past`), curiosidad
  (`curiosidad--investigations`), gracia (`gracia--sneaky-snitch`, `gracia--mischief-maker`), noche
  (`noche--midnight-tale`), reflexión (`reflexion--rumination`), industrial (`industrial--americana`), triste (`triste--decline`, `triste--heavy-heart`).
- **Sonidos**: los pone el motor solo (cada cosa que aparece, pasos, olas, golpes). No hay que pedirlos.
- **Imágenes de verdad**: `historia buscar-imagen "Cnut the Great"` (en inglés) y
  `historia bajar-imagen N "File:…" canuto` → `archivo/canuto.jpg` con su crédito apuntado. **Abre la imagen y mírala**
  antes de usarla (a veces sale otra persona con el mismo nombre). Un retrato por personaje importante. Si Wikimedia pide
  ir más despacio, la orden espera y repite sola: no hagas muchas búsquedas seguidas sin necesidad.

## 7. Revisar antes de montar (lo que más falla)

`historia fotos N` saca hojas de 16 fotos (una cada 3 s). **Ábrelas todas** y busca:
- **Planos que empiezan vacíos** (un mapa sin nada pintado durante 2-3 s): adelanta el `en` de lo primero.
- **Cosas tapadas**: la mascota encima de lo que se cuenta (cámbiala de lado o quítala), dos textos que se pisan, una
  etiqueta encima de una chincheta, un bocadillo cortado.
- **Mapas mal encuadrados**: lo importante cortado en el borde. `historia revisar` avisa con «no cabe en el mapa»: haz el
  mapa más grande (`--zona` más ancha) o usa `"encuadre": false` con una cámara que lo enseñe.
- **Territorios que no se ven** (azul sobre el mar) o fronteras que no cuadran con lo que dice la voz.
- **Caras fuera de cámara**: usa `cara_lugar`.
- Que **lo que dice la voz se vea** en ese momento: cada nombre, año y cifra con su pieza.

Después de arreglar, vuelve a sacar las fotos (salen todas otra vez; unos minutos) y mira las del tramo cambiado. No montes el vídeo final hasta que las hojas estén bien.

## 8. Reglas

- Datos: solo lo que sea verdad. No añadas en pantalla cifras que no diga la voz.
- Nada de frases largas escritas encima de mapas y escenas: en pantalla, nombres, años, cifras y bocadillos cortos.
- Cada cosa con su pieza: una flota vikinga son barcos, no una corona; si una pieza no existe, usa la más parecida
  del catálogo o cuéntalo con una escena.
- No toques `src/` salvo para arreglar un error de verdad.
