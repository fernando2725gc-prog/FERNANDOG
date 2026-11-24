#!/usr/bin/env python3
"""Prepara un mapa de satélite para la plantilla : la imagen de la NASA de una zona y, encima, los
territorios que se van a colorear, ya pasados a píxeles de esa imagen.

    python3 herramientas/preparar_mapa.py --nombre iberia-1492 --zona -10.5 44.5 4.5 35.5 \\
        --hist 1492:Castille=castilla,Aragón=aragon,Portugal=portugal,Navarre=navarra \\
        --paises ESP=espana,PRT=portugal_hoy --regiones "ESP:Granada=granada"

--zona     lon oeste, lat norte, lon este, lat sur (todo lo que vaya a enseñar la cámara, con margen).
--ancho    ancho de la imagen en píxeles (por defecto 3840).
--grados-min  lo más que se va a acercar la cámara (los «grados» más pequeños de los planos de este mapa): el ancho se
           calcula solo para que se vea nítido a 1080p (hasta 12.288 px; el satélite de la NASA tiene 500 m por píxel,
           unos 220 px por grado, y más no da más detalle).
--hist     fronteras históricas de un año: AÑO:Nombre=id,Nombre=id (nombres en inglés de historical-basemaps:
           `--listar 1492` los enseña). Años que hay (negativo = antes de Cristo): -3000 -2000 -1500 -1000 -700 -500
           -400 -323 -300 -200 -100 -1 100 200 300 400 500 600 700 800 900 1000 1100 1200 1279 1300 1400 1492 1500 1530
           1600 1650 1700 1715 1783 1800 1815 1878 1880 1900 1914 1920 1930 1938 1945 1960 1994 2000 2010. Se puede repetir --hist con otro año (la id lleva el año si se repite el nombre).
--paises   países de hoy (Natural Earth, código ISO3): ESP=id,PRT=id; con «+» se juntan en un territorio: MEX+PER=america.
--regiones provincias, regiones o naciones de hoy (Natural Earth; en el Reino Unido: England, Wales, Scotland, Northern
           Ireland): «ISO3:Nombre=id,Nombre+Nombre=id,*=id». Con «+» se juntan
           varias en un territorio; «*» es todo lo que queda del país; un id que empieza por «_» se tira (para quitar
           trozos del «*»). Ej. la España de 1492:
           "ESP:Aragón+Cataluña+Valenciana+Islas Baleares=aragon,Navarra=navarra,Granada+Málaga+Almería=granada,Ceuta+Melilla+Canary Is.=_,*=castilla"

Deja en public/mapas/<nombre>/: satelite.jpg (NASA Blue Marble con relieve del fondo del mar, dominio público) y
mapa.json (tamaño, la caja en Mercator para colocar cualquier lon/lat, la tierra para recortar los colores en la costa
y cada territorio como trazado SVG con su centro). Solo librería estándar.
Fuentes: NASA GIBS (BlueMarble_ShadedRelief_Bathymetry), Natural Earth (dominio público) e historical-basemaps
(A. Ourednik, GPL-3.0: citar en la descripción del vídeo cuando se usen fronteras históricas).
"""
import argparse
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MOTOR = AQUI.parent
CACHE = AQUI / "cache"
CACHE_KIT = CACHE / "naturalearth"
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
HB = "https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/world_{}.geojson"
GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
R = 6378137.0


def merc(lon, lat):
    lat = max(-85.0, min(85.0, lat))
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def bajar(url, destino):
    destino = Path(destino)
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "plantilla-historia/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        datos = r.read()
    destino.write_bytes(datos)
    return destino


def geo(nombre):
    kit = CACHE_KIT / f"{nombre}.geojson"
    ruta = kit if kit.exists() else bajar(NE + nombre + ".geojson", CACHE / "naturalearth" / f"{nombre}.geojson")
    return json.loads(Path(ruta).read_text(encoding="utf-8"))["features"]


def hist(anio):
    nombre = f"bc{-anio}" if anio < 0 else str(anio)
    ruta = bajar(HB.format(nombre), CACHE / "historical" / f"world_{nombre}.geojson")
    return json.loads(ruta.read_text(encoding="utf-8"))["features"]


def anillos(g):
    if not g:
        return []
    if g["type"] == "Polygon":
        return g["coordinates"]
    if g["type"] == "MultiPolygon":
        return [r for p in g["coordinates"] for r in p]
    return []


def sin_acentos(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower().strip()


class Lienzo:
    def __init__(self, zona, ancho):
        lon0, lat1, lon1, lat0 = zona
        self.x0, self.y1 = merc(lon0, lat1)
        self.x1, self.y0 = merc(lon1, lat0)
        self.ancho = int(ancho)
        self.alto = int(round(self.ancho * (self.y1 - self.y0) / (self.x1 - self.x0)))

    def px(self, lon, lat):
        x, y = merc(lon, lat)
        return ((x - self.x0) / (self.x1 - self.x0) * self.ancho, (self.y1 - y) / (self.y1 - self.y0) * self.alto)

    def trazado(self, rings, minimo=1.2, margen=0.6):
        """Anillos lon/lat → «M…Z» en píxeles, quitando puntos a menos de `minimo` px. Solo los anillos que tocan la
        zona (con un margen de `margen` veces su tamaño), para que un imperio enorme no pese en una zona pequeña."""
        partes = []
        mx, my = self.ancho * margen, self.alto * margen
        for ring in rings:
            pts = [self.px(lon, lat) for lon, lat, *_ in ring]
            if len(pts) < 3:
                continue
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            if max(xs) < -mx or min(xs) > self.ancho + mx or max(ys) < -my or min(ys) > self.alto + my:
                continue
            fuera = [pts[0]]
            for p in pts[1:]:
                if abs(p[0] - fuera[-1][0]) + abs(p[1] - fuera[-1][1]) >= minimo:
                    fuera.append(p)
            if len(fuera) < 3:
                continue
            partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in fuera) + "Z")
        return "".join(partes)

    def centro(self, rings):
        """El centro del territorio (media de los centros de sus trozos pesada por su área), para la etiqueta."""
        sx = sy = st = 0.0
        for ring in rings:
            pts = [self.px(lon, lat) for lon, lat, *_ in ring]
            a = cx = cy = 0.0
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                c = x1 * y2 - x2 * y1
                a += c
                cx += (x1 + x2) * c
                cy += (y1 + y2) * c
            if abs(a) < 1e-9:
                continue
            sx += cx / 3
            sy += cy / 3
            st += a
        return [round(sx / st, 1), round(sy / st, 1)] if abs(st) > 1e-9 else None


def satelite(lz, destino):
    """La imagen de la NASA de la caja, en trozos de 2048 px como mucho (el servidor no da imágenes enormes)."""
    import subprocess
    import tempfile
    trozo = 2048
    cols = math.ceil(lz.ancho / trozo)
    filas = math.ceil(lz.alto / trozo)
    tmp = Path(tempfile.mkdtemp(prefix="mapa-sat-"))
    piezas = []
    for f in range(filas):
        for c in range(cols):
            w = min(trozo, lz.ancho - c * trozo)
            h = min(trozo, lz.alto - f * trozo)
            bx0 = lz.x0 + (c * trozo) / lz.ancho * (lz.x1 - lz.x0)
            bx1 = lz.x0 + (c * trozo + w) / lz.ancho * (lz.x1 - lz.x0)
            by1 = lz.y1 - (f * trozo) / lz.alto * (lz.y1 - lz.y0)
            by0 = lz.y1 - (f * trozo + h) / lz.alto * (lz.y1 - lz.y0)
            q = urllib.parse.urlencode({
                "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": "BlueMarble_ShadedRelief_Bathymetry",
                "STYLES": "", "CRS": "EPSG:3857", "BBOX": f"{bx0},{by0},{bx1},{by1}", "WIDTH": w, "HEIGHT": h,
                "FORMAT": "image/jpeg"})
            p = tmp / f"t_{f}_{c}.jpg"
            bajar(f"{GIBS}?{q}", p)
            piezas.append((f, c, p))
    afinar = "unsharp=5:5:0.55:5:5:0.0"
    if len(piezas) == 1:
        subprocess.run([os.environ.get("FFMPEG", "ffmpeg"), "-v", "error", "-y", "-i", str(piezas[0][2]), "-vf", afinar, "-q:v", "2", str(destino)], check=True)
        return
    entradas, filtros = [], []
    for i, (f, c, p) in enumerate(piezas):
        entradas += ["-i", str(p)]
    capas = "".join(f"[{i}]" for i in range(len(piezas)))
    pos = "|".join(f"{c * trozo}_{f * trozo}" for f, c, _ in piezas)
    subprocess.run([os.environ.get("FFMPEG", "ffmpeg"), "-v", "error", "-y", *entradas, "-filter_complex",
                    f"{capas}xstack=inputs={len(piezas)}:layout={pos},{afinar}", "-q:v", "2", str(destino)], check=True)


def pares(texto):
    out = []
    for parte in (texto or "").split(","):
        if not parte.strip():
            continue
        nombre, _, ident = parte.partition("=")
        out.append((nombre.strip(), (ident or nombre).strip()))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--nombre")
    ap.add_argument("--zona", nargs=4, type=float, metavar=("LON_O", "LAT_N", "LON_E", "LAT_S"))
    ap.add_argument("--ancho", type=int, default=3840)
    ap.add_argument("--grados-min", type=float, help="los grados más pequeños que usará la cámara: calcula el ancho")
    ap.add_argument("--hist", action="append", default=[])
    ap.add_argument("--paises", default="")
    ap.add_argument("--regiones", action="append", default=[])
    ap.add_argument("--listar", type=int, help="enseña los nombres de las fronteras históricas de ese año en la zona")
    # los años antes de Cristo van en negativo («--hist -700:Assyria=asiria») y argparse los confunde con una opción
    argv, i = sys.argv[1:], 0
    while i < len(argv) - 1:
        if argv[i] in ("--hist", "--regiones", "--paises", "--listar") and argv[i + 1].startswith("-") and not argv[i + 1].startswith("--"):
            argv[i:i + 2] = [f"{argv[i]}={argv[i + 1]}"]
        i += 1
    a = ap.parse_args(argv)

    if a.listar is not None:
        feats = hist(a.listar)
        nombres = []
        for f in feats:
            rings = anillos(f["geometry"])
            if not rings:
                continue
            if a.zona:
                lon0, lat1, lon1, lat0 = a.zona
                xs = [p[0] for r in rings for p in r]
                ys = [p[1] for r in rings for p in r]
                if max(xs) < lon0 or min(xs) > lon1 or max(ys) < lat0 or min(ys) > lat1:
                    continue
            nombres.append(f["properties"].get("NAME"))
        print(json.dumps({"ok": True, "anio": a.listar, "nombres": sorted(set(n for n in nombres if n))}, ensure_ascii=False))
        return
    if not a.nombre or not a.zona:
        ap.error("faltan --nombre y --zona")

    ancho = a.ancho
    if a.grados_min:
        ancho = max(ancho, min(12288, int(1920 * (a.zona[2] - a.zona[0]) / a.grados_min * 1.15)))
        ancho -= ancho % 16
    lz = Lienzo(a.zona, ancho)
    if lz.alto > 4 * lz.ancho or lz.alto < 100:
        sys.exit("La zona no tiene buena forma: mira el orden (lon oeste, lat norte, lon este, lat sur).")
    dest = MOTOR / "public" / "mapas" / a.nombre
    dest.mkdir(parents=True, exist_ok=True)
    satelite(lz, dest / "satelite.jpg")

    capas = {}
    falta = []
    for h in a.hist:
        anio_txt, _, lista = h.partition(":")
        anio = int(anio_txt)
        feats = hist(anio)
        for nombre, ident in pares(lista):
            rings = [r for f in feats if sin_acentos(f["properties"].get("NAME")) == sin_acentos(nombre) for r in anillos(f["geometry"])]
            if not rings:
                falta.append(f"{anio}:{nombre}")
                continue
            capas[ident] = {"d": lz.trazado(rings), "centro": lz.centro(rings), "nombre": nombre, "fuente": f"historical-basemaps {anio}"}
    # un mismo id en varios países (--paises y --regiones, o dos --regiones) se junta en un solo territorio: el reino
    # cruzado de Jerusalén = Israel + Palestina + el sur del Líbano (11-11-2026)
    juntos = {}
    def poner(ident, rings, fuente):
        juntos.setdefault(ident, []).extend(rings)
        capas[ident] = {"d": lz.trazado(juntos[ident]), "centro": lz.centro(juntos[ident]), "nombre": ident, "fuente": fuente}
    if a.paises:
        feats = geo("ne_50m_admin_0_countries")
        grupos = {}
        for isos, ident in pares(a.paises):
            for iso in isos.split("+"):
                rings = [r for f in feats if (f["properties"].get("ADM0_A3") or f["properties"].get("ISO_A3")) == iso.strip().upper() for r in anillos(f["geometry"])]
                if not rings:
                    falta.append(iso)
                grupos.setdefault(ident, []).extend(rings)
        for ident, rings in grupos.items():
            if rings:
                poner(ident, rings, "Natural Earth")
    for reg in a.regiones:
        iso, _, lista = reg.partition(":")
        feats = [f for f in geo("ne_10m_admin_1_states_provinces") if f["properties"].get("adm0_a3") == iso.strip().upper()]
        usadas = set()
        grupos = {}
        resto = None
        for nombres, ident in pares(lista):
            if nombres.strip() == "*":
                resto = ident
                continue
            for nombre in nombres.split("+"):
                n = sin_acentos(nombre)
                hits = [i for i, f in enumerate(feats) if n in (sin_acentos(f["properties"].get("name")), sin_acentos(f["properties"].get("region")), sin_acentos(f["properties"].get("geonunit")))]
                if not hits:
                    falta.append(f"{iso}:{nombre}")
                usadas.update(hits)
                grupos.setdefault(ident, []).extend(hits)
        if resto:
            grupos[resto] = [i for i in range(len(feats)) if i not in usadas]
        for ident, idx in grupos.items():
            if ident.startswith("_") or not idx:
                continue
            rings = [r for i in idx for r in anillos(feats[i]["geometry"])]
            poner(ident, rings, "Natural Earth")
    tierra = lz.trazado([r for f in geo("ne_50m_land") for r in anillos(f["geometry"])], minimo=1.0)
    # los lagos salen casi negros en el satélite: el motor los pinta de azul encima
    lagos = lz.trazado([r for f in geo("ne_50m_lakes") for r in anillos(f["geometry"])], minimo=1.0, margen=0.1)
    mapa = {"nombre": a.nombre, "ancho": lz.ancho, "alto": lz.alto, "zona": a.zona,
            "merc": [lz.x0, lz.y0, lz.x1, lz.y1], "tierra": tierra, "lagos": lagos, "capas": capas}
    (dest / "mapa.json").write_text(json.dumps(mapa, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"ok": not falta, "carpeta": str(dest), "ancho": lz.ancho, "alto": lz.alto,
                      "capas": sorted(capas), "no_encontradas": falta}, ensure_ascii=False))


if __name__ == "__main__":
    main()
