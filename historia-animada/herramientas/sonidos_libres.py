#!/usr/bin/env python3
"""Efectos de sonido de la plantilla, gratis y de uso libre: baja tres packs de Kenney (kenney.nl, licencia CC0:
dominio público, se pueden usar en un canal monetizado sin citar) y los deja en public/sfx/ con nombres en español;
los que no están en los packs (olas, viento, cascos de mula) los fabrica con ffmpeg. El motor (VideoTerra.tsx) los pone
solos según lo que se ve: monedas, pasos, golpes, picos, papel…

    python3 herramientas/sonidos_libres.py          # baja lo que falte y prepara public/sfx/
Solo librería estándar y ffmpeg.
"""
import json
import subprocess
import urllib.request
import http.cookiejar
import zipfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MOTOR = AQUI.parent
CACHE = AQUI / "cache" / "kenney"
SFX = MOTOR / "public" / "sfx"
PACKS = ["rpg-audio", "impact-sounds", "interface-sounds"]

# nombre en el motor ← archivos del pack (si hay varios, se juntan con un hueco entre ellos)
SIMPLES = {
    "monedas": ["rpg-audio/Audio/handleCoins.ogg"],
    "monedas2": ["rpg-audio/Audio/handleCoins2.ogg"],
    "chincheta": ["interface-sounds/Audio/drop_002.ogg"],
    "territorio": ["interface-sounds/Audio/pluck_001.ogg"],
    "letra": ["interface-sounds/Audio/tick_002.ogg"],
    "tarjeta": ["rpg-audio/Audio/bookPlace1.ogg"],
    "hoja": ["rpg-audio/Audio/bookFlip2.ogg"],
    "cifra": ["impact-sounds/Audio/impactPlate_medium_001.ogg"],
    "corona": ["interface-sounds/Audio/confirmation_002.ogg"],
    "golpe": ["impact-sounds/Audio/impactPunch_heavy_000.ogg"],
    "sordo": ["impact-sounds/Audio/impactSoft_heavy_001.ogg"],
    "metal": ["impact-sounds/Audio/impactMetal_medium_002.ogg"],
    "piedra": ["impact-sounds/Audio/impactPlate_heavy_000.ogg"],
    "cristal": ["impact-sounds/Audio/impactGlass_light_001.ogg"],
    "campana": ["impact-sounds/Audio/impactBell_heavy_001.ogg"],
    "tela": ["rpg-audio/Audio/cloth2.ogg"],
    "puerta": ["rpg-audio/Audio/doorOpen_1.ogg"],
    "madera": ["impact-sounds/Audio/impactWood_medium_001.ogg"],
}
SERIES = {
    # (archivos, segundos entre uno y otro)
    "pasos": ([f"impact-sounds/Audio/footstep_grass_00{i}.ogg" for i in range(5)], 0.36),
    "pasos_madera": ([f"impact-sounds/Audio/footstep_wood_00{i}.ogg" for i in range(5)], 0.36),
    "picos": ([f"impact-sounds/Audio/impactMining_00{i}.ogg" for i in range(5)], 0.7),
}


def bajar_pack(nombre):
    zipf = CACHE / f"{nombre}.zip"
    if not zipf.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        jar = http.cookiejar.CookieJar()
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        op.addheaders = [("User-Agent", "Mozilla/5.0")]
        op.open(f"https://kenney.nl/assets/{nombre}", timeout=60).read()
        ident = f"assets/{nombre}".encode().hex()
        datos = json.loads(op.open(f"https://kenney.nl/download-link/{ident}", timeout=60).read())
        zipf.write_bytes(op.open(datos["url"], timeout=180).read())
    destino = CACHE / "x" / nombre
    if not destino.exists():
        destino.mkdir(parents=True)
        with zipfile.ZipFile(zipf) as z:
            for m in z.namelist():  # solo audio y la licencia, dentro de su carpeta
                if (m.endswith(".ogg") or m.endswith("License.txt")) and ".." not in m and not m.startswith("/"):
                    z.extract(m, destino)


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def main():
    for p in PACKS:
        bajar_pack(p)
    SFX.mkdir(parents=True, exist_ok=True)
    base = CACHE / "x"
    hechos = []
    for nombre, archivos in SIMPLES.items():
        ff("-i", str(base / archivos[0]), "-ac", "2", "-ar", "44100", "-b:a", "160k", str(SFX / f"{nombre}.mp3"))
        hechos.append(nombre)
    for nombre, (archivos, hueco) in SERIES.items():
        entradas, filtros = [], []
        for i, a in enumerate(archivos):
            entradas += ["-i", str(base / a)]
            filtros.append(f"[{i}]adelay={int(i * hueco * 1000)}|{int(i * hueco * 1000)},aformat=channel_layouts=stereo[a{i}]")
        mezcla = "".join(f"[a{i}]" for i in range(len(archivos)))
        ff(*entradas, "-filter_complex", ";".join(filtros) + f";{mezcla}amix=inputs={len(archivos)}:normalize=0", "-ar", "44100", "-b:a", "160k", str(SFX / f"{nombre}.mp3"))
        hechos.append(nombre)
    # hechos con ffmpeg: olas (ruido rosa que sube y baja), viento suave y cascos de mula (clip-clop)
    ff("-f", "lavfi", "-i", "anoisesrc=d=8:c=pink:a=0.6", "-af",
       "lowpass=f=900,highpass=f=80,volume='0.35+0.65*pow(sin(2*PI*t/4),2)':eval=frame,afade=t=in:d=0.8,afade=t=out:st=7:d=1",
       "-ac", "2", "-ar", "44100", "-b:a", "160k", str(SFX / "olas.mp3"))
    ff("-f", "lavfi", "-i", "anoisesrc=d=8:c=brown:a=0.5", "-af",
       "bandpass=f=420:w=0.8,volume='0.4+0.6*pow(sin(2*PI*t/5.5),2)':eval=frame,afade=t=in:d=1,afade=t=out:st=6.5:d=1.5",
       "-ac", "2", "-ar", "44100", "-b:a", "160k", str(SFX / "viento.mp3"))
    cascos = base / "impact-sounds/Audio/impactWood_light_002.ogg"
    entradas, filtros = [], []
    for i, t in enumerate([0, 0.18, 0.6, 0.78, 1.2, 1.38, 1.8, 1.98]):
        entradas += ["-i", str(cascos)]
        filtros.append(f"[{i}]asetrate=44100*{1.15 if i % 2 else 1.0},aresample=44100,adelay={int(t * 1000)}|{int(t * 1000)},aformat=channel_layouts=stereo[c{i}]")
    ff(*entradas, "-filter_complex", ";".join(filtros) + ";" + "".join(f"[c{i}]" for i in range(8)) + "amix=inputs=8:normalize=0",
       "-ar", "44100", "-b:a", "160k", str(SFX / "cascos.mp3"))
    # lluvia (ruido blanco filtrado con gotas) y trago (dos golpes graves y suaves)
    ff("-f", "lavfi", "-i", "anoisesrc=d=8:c=white:a=0.5", "-af",
       "highpass=f=700,lowpass=f=6000,volume='0.6+0.4*pow(sin(2*PI*t/3),2)':eval=frame,afade=t=in:d=0.8,afade=t=out:st=7:d=1",
       "-ac", "2", "-ar", "44100", "-b:a", "160k", str(SFX / "lluvia.mp3"))
    ff("-f", "lavfi", "-i", "sine=f=150:d=0.5", "-af",
       "volume='if(lt(t,0.12),1,if(lt(t,0.24),0,if(lt(t,0.36),0.8,0)))':eval=frame,lowpass=f=400,afade=t=out:st=0.35:d=0.15",
       "-ac", "2", "-ar", "44100", "-b:a", "160k", str(SFX / "trago.mp3"))
    hechos += ["olas", "viento", "cascos", "lluvia", "trago"]
    (SFX / "creditos-sonidos.txt").write_text(
        "Efectos de Kenney (kenney.nl): RPG Audio, Impact Sounds e Interface Sounds. Licencia CC0 (dominio público): no hace\n"
        "falta citarlos. olas, viento, cascos, lluvia, trago, pop, clic y whoosh: hechos con ffmpeg para este motor.\n", encoding="utf-8")
    print(json.dumps({"ok": True, "sonidos": sorted(hechos)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
