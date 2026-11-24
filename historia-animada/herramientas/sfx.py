# Genera los efectos de sonido de los caballeros con ElevenLabs (sound-generation) en public/sfx/. Solo hace los que faltan.
#   python3 herramientas/sfx.py
import json, os, urllib.request
from pathlib import Path
raiz = Path(__file__).resolve().parents[3]
clave = os.environ.get("ELEVENLABS_API_KEY") or next((l.split("=", 1)[1].strip().strip('"') for l in open(raiz / ".env") if l.startswith("ELEVENLABS_API_KEY")), None)
destino = Path(__file__).resolve().parents[1] / "public" / "sfx"
EFECTOS = {
    "lluvia": (10.0, "steady rain falling on a muddy field, light wind, ambience loop, no thunder, no music"),
    "volea": (2.5, "volley of hundreds of arrows whistling through the air overhead, whoosh swarm, no music"),
    "flecha_madera": (0.8, "single arrow thunk hitting a wooden shield, short sharp impact with wobble, no music"),
    "flecha_barro": (0.6, "arrow sticking into wet mud, short soft thud, no music"),
    "clonk_yelmo": (0.8, "cartoon metal bonk, arrow hitting a steel helmet, comedic ringing tonk, short, no music"),
    "rebote": (0.8, "arrow ricochet off steel armor, quick metallic ting and whizz away, no music"),
    "armadura": (1.0, "single heavy steel armor plate clamping on, metallic clank, short, no music"),
    "peso": (0.8, "heavy cartoon weight thud landing on the ground, short, no music"),
    "trago": (0.6, "cartoon nervous gulp swallow, comedic, short, no music"),
    "lanzar": (0.7, "quick whoosh of an object being thrown and spinning, short, no music"),
    "caida_barro": (1.0, "person in armor falling face first into mud, metallic clatter and wet splat, comedic, no music"),
    "brillo": (0.8, "cartoon sparkle twinkle shine, short, no music"),
    "pergamino": (0.8, "soft paper swoosh transition, old film flicker, short, no music"),
}
destino.mkdir(parents=True, exist_ok=True)
for nombre, (seg, texto) in EFECTOS.items():
    ruta = destino / f"{nombre}.mp3"
    if ruta.exists() and ruta.stat().st_size > 4000:
        continue
    cuerpo = json.dumps({"text": texto, "duration_seconds": seg, "prompt_influence": 0.5}).encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation", data=cuerpo, headers={"xi-api-key": clave, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r, open(ruta, "wb") as f:
            f.write(r.read())
        print("ok", nombre, ruta.stat().st_size, flush=True)
    except Exception as e:
        print("FALLO", nombre, e, getattr(e, "read", lambda: b"")()[:300], flush=True)
