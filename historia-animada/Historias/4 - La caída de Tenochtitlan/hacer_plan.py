import json, sys

TEN = [-99.13, 19.43]   # Tenochtitlan
TEX = [-98.88, 19.51]   # Texcoco
TLA = [-99.19, 19.46]   # Tlacopan
TLX = [-98.24, 19.32]   # Tlaxcala
VER = [-96.40, 19.65]   # Villa Rica de la Vera Cruz
CEM = [-96.41, 19.44]   # Cempoala

MAPA = "mesoamerica"
MOC = {"color": "#2fa35a", "capa": "#1f6f8a", "sombreroColor": "#2fa35a"}   # Moctezuma
CUA = {"color": "#8a1c24", "sombreroColor": "#f2c230"}                     # Cuauhtémoc
MAL = {"color": "#f4efe3", "ribete": "#2fa35a", "sombreroColor": "#2fa35a"}  # Malintzin
TLXC = {"color": "#2f6b2f", "ribete": "#f4efe3", "sombreroColor": "#f4efe3"}  # tlaxcalteca


def mapa(en, cam, hasta=None, fecha=None, **kw):
    p = {"en": en, "tipo": "mapa", "mapa": MAPA, "cam": dict(zip(("lon", "lat", "grados"), cam))}
    if hasta:
        p["hasta"] = dict(zip(("lon", "lat", "grados"), hasta))
    if fecha:
        p["fecha"] = fecha
    p.update(kw)
    return p


def esc(en, decorado, actores=(), **kw):
    p = {"en": en, "tipo": "escena", "decorado": decorado, "actores": list(actores)}
    if not actores:
        p["paisaje"] = True
    p.update(kw)
    return p


def act(q, traje, x, mira, acciones=(), s=1.1, **kw):
    a = {"q": q, "traje": traje, "x": x, "s": s, "mira": mira, "acciones": [{"en": e, "hace": h} for e, h in acciones]}
    a.update(kw)
    return a


def nar(en, *cosas):
    return {"en": en, "tipo": "narrador", "cosas": list(cosas)}


def fecha(t):
    return {"en": 0, "tipo": "fecha", "texto": t}


def pin(en, ll, nombre, **kw):
    d = {"en": en, "lon": ll[0], "lat": ll[1], "nombre": nombre}
    d.update(kw)
    return d


def bo(en, a, texto, ancho=340):
    en = en if isinstance(en, (int, float)) else 0.3
    return {"en": en, "a": a, "texto": texto, "ancho": ancho}


def cosa(en, c, x, y, salta=-60):
    return {"en": en, "cosa": c, "x": x, "y": y, "salta": salta}


def rot(en, texto, x=960, y=230, tam=72, rojo=False):
    r = {"en": en, "texto": texto, "x": x, "y": y, "tam": tam}
    if rojo:
        r["rojo"] = True
    return r


IMP = lambda en=0, **kw: dict({"en": en, "id": "imperio", "color": "rojo", "op": 0.5}, **kw)

planos = [
    # ---------------- GANCHO ----------------
    mapa(0, [-99.5, 19.6, 14], [-99.2, 19.5, 9], "1519", encuadre=False,
         capas=[{"en": "noviembre", "id": "imperio", "color": "rojo", "op": 0.45}],
         rotulos=[rot("1519", "8 de noviembre", 560, 300, 80)]),
    mapa("avanzaron", [-99.0, 19.45, 7], [-99.12, 19.43, 4.5], "1519", encuadre=False,
         pins=[pin("camino", TEN, "Tenochtitlan", aro=True)],
         ejercitos=[{"en": "camino", "de": [-98.75, 19.15], "a": [-99.1, 19.4], "d": 3, "color": "blanco"}],
         rotulos=[rot("lago", "Un camino sobre un lago", 560, 300, 70, True)]),
    esc("Al fondo", "tenochtitlan", [
        act("soldado", "conquistador", 620, 0.5, [("fondo", "susto")], lleva="espada"),
        act("capitan", "conquistador", 900, 0.5, [("ciudad", "senala")])],
        bocadillos=[bo("flotar", "soldado", "¿Eso es de verdad?")],
        rotulos=[fecha("Calzada de Iztapalapa, 1519")]),
    esc("Templos, palacios", "tenochtitlan", [
        act("remero", "azteca", 760, 0.4, [("canales", "saluda")]),
        act("mercader", "indigena", 1180, -0.4, [("canoas", "asiente")], lleva="especias")]),
    nar("Uno de ellos escribió",
        {"en": "escribió", "tarjeta": "Bernal Díaz del Castillo", "cosa": "libro"},
        {"en": "encantamiento", "palabra": "«Cosa de encantamiento»", "rojo": True}),
    mapa("Era Tenochtitlan", [-99.4, 19.6, 12], [-99.2, 19.5, 9], "1519",
         capas=[{"en": "Imperio", "id": "imperio", "color": "rojo", "etiqueta": "Imperio azteca"}],
         pins=[pin("capital", TEN, "Tenochtitlan", aro=True)]),
    nar("Una de las ciudades",
        {"en": "ciudades", "tarjeta": "Una de las más grandes del mundo", "cosa": "corona"}),
    esc("Dos años después", "tenochtitlan", [], noche=True, humo=True,
        cosas=[cosa("ruinas", "fuego", 960, 520)], rotulos=[fecha("1521")]),
    esc("Un emperador prisionero", "sala_trono", [
        act("Moctezuma", "azteca", 1210, -0.3, [("prisionero", "triste")], sentado=True, y=710, colores=MOC),
        act("guardia", "conquistador", 760, 0.5, [("palacio", "jarras")], lleva="espada")],
        cosas=[cosa("palacio", "cadenas", 1210, 520)]),
    esc("Una huida en plena", "laguna", [
        act("s1", "conquistador", 700, 0.6, [("huida", "camina")], lleva="saco"),
        act("s2", "conquistador", 1050, 0.6, [("noche", "susto")], lleva="oro")], noche=True,
        cosas=[cosa("oro", "oro", 1350, 700)]),
    nar("Una enfermedad que",
        {"en": "enfermedad", "cosa": "calavera", "pie": "Una enfermedad desconocida"}),
    nar("Y unos barcos de guerra",
        {"en": "barcos", "cosa": "galera", "pie": "Barcos de guerra…"},
        {"en": "montañas", "palabra": "¡En las montañas!", "rojo": True}),
    nar("Cómo cayó el imperio",
        {"en": "Cómo", "palabra": "¿Cómo?", "rojo": True},
        {"en": "dos años", "cifra": "2", "sub": "años", "icono": "reloj"}),
    {"en": "Esta es la historia", "tipo": "capitulo", "numero": 0},

    # ---------------- 1. 1325 ----------------
    {"en": "Valle de México, hacia", "tipo": "capitulo", "numero": 1},
    mapa("Un pueblo llega", [-102.5, 24, 20], [-100.5, 21.5, 14], "1325",
         ejercitos=[{"en": "norte", "de": [-106, 28], "a": [-99.3, 19.7], "d": 3.5, "color": "amarillo"}],
         rotulos=[rot("siglos", "≈200 años caminando", 560, 300, 70, True)]),
    esc("Se llaman a sí mismos", "montana", [
        act("m1", "indigena", 600, 0.5, [("llaman", "orgulloso")], lleva="saco"),
        act("m2", "indigena", 850, 0.5, [("mexicas", "saluda")]),
        act("vecino", "azteca", 1400, -0.5, [("nadie", "jarras")], colores={"color": "#7a5230"})],
        bocadillos=[bo("nadie", "vecino", "¿Y estos quiénes son?")],
        rotulos=[rot("mexicas", "Los mexicas", 720, 230, 80)]),
    mapa("Los pueblos del valle", [-98.9, 19.5, 6], [-99.05, 19.45, 4], "1325",
         pins=[pin("lago", [-98.98, 19.5], "Lago de Texcoco", mar=True)],
         foco={"en": "islote", "lon": TEN[0], "lat": TEN[1], "radio": 220},
         iconos=[{"en": "islote", "lon": TEN[0], "lat": TEN[1] - 0.2, "cosa": "islote", "tam": 0.5}]),
    esc("Lleno de serpientes", "laguna", [
        act("m1", "indigena", 760, 0.4, [("serpientes", "susto")]),
        act("m2", "indigena", 1150, -0.4, [("mosquitos", "enfada")])],
        bocadillos=[bo(0.1, "m2", "¿Aquí? ¿Seguro?")]),
    nar("Pero según la leyenda",
        {"en": "señal", "tarjeta": "La señal prometida", "cosa": "sol"},
        {"en": "águila", "palabra": "Águila"},
        {"en": "nopal", "palabra": "Nopal"},
        {"en": "serpiente", "palabra": "Serpiente", "rojo": True}),
    nar("Si la imagen te suena",
        {"en": "bandera", "cosa": "escudo", "pie": "El escudo de la bandera de México"}),
    esc("En ese islote", "laguna", [
        act("m1", "indigena", 700, 0.4, [("fundan", "levanta")], lleva="pico"),
        act("m2", "azteca", 1150, -0.4, [("Tenochtitlan", "celebra")])],
        rotulos=[fecha("Tenochtitlan, 1325")]),
    esc("Es como si te dieran", "laguna", [
        act("m1", "azteca", 960, 0.2, [("terreno", "encoge"), ("impresionante", "orgulloso")])],
        bocadillos=[bo("construyeras", "m1", "Vista al lago, ¿eh?")]),

    # ---------------- 2. 1428 ----------------
    {"en": "Año 1428", "tipo": "capitulo", "numero": 2},
    mapa("Se alían con otras", [-98.95, 19.5, 5], [-99.0, 19.48, 4], "1428", guia={"lado": "izquierda"},
         pins=[pin("ciudades", TEN, "Tenochtitlan", izquierda=True), pin("Texcoco", TEX, "Texcoco")]),
    {"en": "y forman la Triple", "tipo": "papel", "titulo": "La Triple Alianza",
     "cosas": [{"en": "forman", "cosa": "piramide", "pie": "Tenochtitlan"},
               {"en": "Triple", "cosa": "templo", "pie": "Texcoco"},
               {"en": "Alianza", "cosa": "escudo", "pie": "Tlacopan"}]},
    mapa("En menos de un siglo", [-98, 19.5, 22], [-98.5, 19, 17], "1428-1519",
         capas=[{"en": "dominan", "id": "imperio", "color": "rojo", "modo": "crece", "etiqueta": "Imperio azteca",
                 "cara": "malo", "cara_en": "Pacífico"}],
         pins=[pin("golfo", [-94.5, 21.5], "Golfo de México", mar=True), pin("Pacífico", [-102, 16], "Océano Pacífico", mar=True)]),
    esc("Cientos de pueblos", "sala_trono", [
        act("tlatoani", "azteca", 1210, -0.3, [("tributo", "orgulloso")], sentado=True, y=710, colores=MOC),
        act("v1", "indigena", 620, 0.5, [("pagan", "agacha")], lleva="saco"),
        act("v2", "indigena", 860, 0.5, [("algodón", "agacha")], lleva="especias")],
        cosas=[cosa("maíz", "trigo", 980, 640), cosa("plumas", "pluma", 1450, 600), cosa("oro", "oro", 1500, 760)],
        bocadillos=[bo("tributo", "tlatoani", "Póngalo ahí, gracias.")]),
    nar("El cacao era tan valioso",
        {"en": "cacao", "tarjeta": "Cacao", "cosa": "cuenco"},
        {"en": "dinero", "cosa": "moneda", "pie": "Se usaba como dinero"},
        {"en": "árboles", "palabra": "El dinero crecía en los árboles", "rojo": True}),
    nar("Pero el imperio tiene",
        {"en": "oscuro", "palabra": "El lado oscuro", "rojo": True}, {"en": "imperio", "cosa": "calavera", "pie": "Guerra y sacrificios"}),
    esc("Los mexicas hacen la guerra", "campo", [
        act("guerrero", "azteca", 1250, -0.5, [("guerra", "ataca"), ("prisioneros", "orgulloso")], lleva="escudo"),
        act("cautivo", "indigena", 700, 0.5, [("conseguir", "cae"), ("prisioneros", "triste")])],
        cosas=[cosa("prisioneros", "cadenas", 700, 560)]),
    nar("y muchos de ellos",
        {"en": "sacrificados", "cosa": "templo", "pie": "Sacrificios en lo alto de los templos"},
        {"en": "dioses", "tarjeta": "Para alimentar a los dioses", "cosa": "sol"}),
    mapa("Los pueblos sometidos", [-99, 19, 16], [-98.8, 19, 13], "1500",
         capas=[{"en": 0, "id": "imperio", "color": "rojo", "op": 0.55, "etiqueta": "Imperio azteca",
                 "cara": "malo", "cara_en": "odian"}],
         iconos=[{"en": "pagan", "lon": -97.2, "lat": 17.8, "cosa": "monton_monedas", "tam": 0.6}]),
    mapa("Y hay uno que", [-98.5, 19.4, 8], [-98.4, 19.35, 6], "1500",
         capas=[IMP(), {"en": "Tlaxcala", "id": "tlaxcala", "color": "verde", "etiqueta": "Tlaxcala",
                        "cara": "enfado", "cara_en": "jamás"}],
         foco={"en": "conquistada", "capa": "tlaxcala"}),
    nar("Recuerda ese nombre",
        {"en": "Recuerda", "tarjeta": "Tlaxcala", "cosa": "escudo"},
        {"en": "nombre", "palabra": "¡Recuérdalo!", "rojo": True}),

    # ---------------- 3. La ciudad ----------------
    {"en": "Ahora, entremos", "tipo": "capitulo", "numero": 3},
    {"en": "Tenochtitlan, hacia el", "tipo": "papel", "titulo": "Una ciudad sobre el lago",
     "cosas": [{"en": "1500", "cosa": "isla", "pie": "Tenochtitlan"},
               {"en": "calzadas", "cosa": "muro", "pie": "3 calzadas a tierra firme"}]},
    esc("Un acueducto trae", "tenochtitlan", [
        act("aguador", "indigena", 800, 0.4, [("agua", "levanta")], lleva="cuenco"),
        act("vecino", "azteca", 1200, -0.4, [("Chapultepec", "asiente")])],
        bocadillos=[bo(0.3, "aguador", "Agua del bosque, recién llegada.", 380)],
        rotulos=[rot("Chapultepec", "Acueducto de Chapultepec", 960, 230, 64)]),
    esc("Alrededor, los mexicas", "tenochtitlan", [
        act("c1", "indigena", 700, 0.4, [("chinampas", "agacha")], lleva="pico"),
        act("c2", "campesina", 1150, -0.4, [("cosechan", "celebra")])],
        cosas=[cosa("maíz", "trigo", 960, 760)],
        bocadillos=[bo("huertos", "c1", "Huerto con vista al lago.")],
        rotulos=[rot("chinampas", "Chinampas", 960, 230, 80)]),
    nar("En el centro se alza",
        {"en": "Templo Mayor", "cosa": "piramide", "pie": "El Templo Mayor"},
        {"en": "santuarios", "tarjeta": "2 santuarios en lo alto", "cosa": "templo"}),
    {"en": "uno para Huitzilopochtli", "tipo": "papel", "titulo": "Los dos dioses del Templo Mayor",
     "cosas": [{"en": "Huitzilopochtli", "cosa": "espada", "pie": "Huitzilopochtli: la guerra"},
               {"en": "Tláloc", "cosa": "cuenco", "pie": "Tláloc: la lluvia"}]},
    esc("Y al lado, en Tlatelolco", "tenochtitlan", [
        act("vendedora", "indigena", 620, 0.5, [("mercado", "saluda")], lleva="trigo", colores=MAL),
        act("vendedor", "azteca", 940, 0.4, [("grande", "orgulloso")], lleva="pluma"),
        act("soldado", "conquistador", 1350, -0.5, [("nunca", "susto")])],
        bocadillos=[bo("nunca", "soldado", "¡Ni en Sevilla!")],
        rotulos=[fecha("Mercado de Tlatelolco")]),
    nar("Algunos soldados que",
        {"en": "Roma", "tarjeta": "Roma", "cosa": "cupula"},
        {"en": "Constantinopla", "tarjeta": "Constantinopla", "cosa": "muralla"},
        {"en": "igual", "palabra": "Ninguna como esta", "rojo": True}),
    {"en": "En la ciudad vivían", "tipo": "papel", "titulo": "Tenochtitlan contra Europa",
     "cosas": [{"en": "personas", "cosa": "piramide", "pie": "Tenochtitlan"},
               {"en": "Europa", "cosa": "castillo", "pie": "Casi cualquier ciudad europea"}]},
    esc("Y era muy limpia", "tenochtitlan", [
        act("b1", "indigena", 760, 0.4, [("limpia", "agacha")]),
        act("b2", "azteca", 1150, -0.4, [("barrían", "orgulloso")])],
        bocadillos=[bo("calles", "b2", "Aquí no se tira nada.")]),
    nar("La llamaron la Venecia",
        {"en": "Venecia", "tarjeta": "La Venecia de América", "cosa": "isla"}),
    esc("Y en 1502", "sala_trono", [
        act("Moctezuma", "azteca", 1210, -0.2, [("trono", "orgulloso"), ("Moctezuma", "mira_camara")],
            sentado=True, y=710, colores=MOC)],
        cosas=[cosa("trono", "corona", 860, 520, -90)],
        rotulos=[fecha("Tenochtitlan, 1502"), rot("Moctezuma", "Moctezuma", 620, 300, 90)]),

    # ---------------- 4. 1519 ----------------
    {"en": "Año 1519. Un capitán", "tipo": "capitulo", "numero": 4},
    esc("Hernán Cortés, zarpa", "puerto", [
        act("Cortés", "conquistador", 960, 0.2, [("Cortés", "orgulloso"), ("zarpa", "senala")], s=1.25)],
        rotulos=[rot("Cortés", "Hernán Cortés", 960, 220, 76), fecha("Cuba, 1519")]),
    {"en": "once barcos", "tipo": "papel", "titulo": "La expedición de Cortés",
     "cosas": [{"en": "once", "cosa": "carabela", "pie": "11 barcos"},
               {"en": "quinientos", "cosa": "espada", "pie": "≈500 hombres"},
               {"en": "dieciséis", "cosa": "caballo", "pie": "16 caballos"}]},
    mapa("Desembarca en la costa", [-89, 21, 26], [-91, 20.5, 20], "1519", guia=False,
         capas=[{"en": 0, "id": "cuba", "color": "amarillo", "etiqueta": "Cuba"}, IMP("costa")],
         barcos=[{"en": 0, "de": [-84.5, 21.9], "a": [-96.2, 19.6], "d": 4, "flota": 4, "color": "rojo", "curva": 0.1}],
         pins=[pin("Veracruz", VER, "Veracruz", aro=True)]),
    esc("Allí conoce a una joven", "puerto", [
        act("Malintzin", "indigena", 1150, -0.4, [("joven", "saluda"), ("maya", "orgulloso")], colores=MAL),
        act("Cortés", "conquistador", 650, 0.5, [("náhuatl", "susto"), ("Malinche", "asiente")])],
        bocadillos=[bo("maya", "Malintzin", "Yo les traduzco.")],
        rotulos=[rot("Malintzin", "Malintzin", 1150, 260, 70), rot("Malinche", "«La Malinche»", 1150, 340, 60, True)]),
    nar("Ella se convierte",
        {"en": "intérprete", "tarjeta": "Intérprete", "cosa": "libro"},
        {"en": "consejera", "tarjeta": "Consejera", "cosa": "pluma"},
        {"en": "clave", "palabra": "La pieza clave", "rojo": True}),
    esc("Sin ella, Cortés", "campamento", [
        act("guerrero", "azteca", 1200, -0.5, [("Sin", "senala")]),
        act("Cortés", "conquistador", 700, 0.5, [("perdido", "encoge")])],
        bocadillos=[bo(0.1, "guerrero", "¿Tlein?"), bo(1.9, "Cortés", "¿Perdón?")]),
    esc("Los españoles traen cosas", "selva", [
        act("jinete", "conquistador", 700, 0.5, [("caballos", "orgulloso")], montado=True),
        act("guerrero", "azteca", 1300, -0.5, [("animal", "susto")])],
        cosas=[cosa("cañones", "canon", 1000, 900, -40)],
        bocadillos=[bo("animal", "guerrero", "¿Qué bicho es ese?")]),
    {"en": "Pero eran muy pocos", "tipo": "papel", "titulo": "Las cuentas no salen",
     "cosas": [{"en": "Quinientos", "cosa": "espada", "pie": "500 españoles"},
               {"en": "millones", "cosa": "corona", "pie": "Un imperio de millones"}]},
    esc("Para que nadie pueda", "puerto", [
        act("Cortés", "conquistador", 1250, -0.4, [("hundir", "senala")]),
        act("soldado", "conquistador", 650, 0.5, [("barcos", "susto")], lleva="espada")],
        bocadillos=[bo("vuelve", "soldado", "¿Y cómo volvemos?")]),
    mapa("En el camino hacia", [-97.4, 19.5, 6], [-97.8, 19.4, 5], "1519",
         capas=[{"en": "Tlaxcala", "id": "tlaxcala", "color": "verde", "etiqueta": "Tlaxcala"}],
         ejercitos=[{"en": "camino", "de": VER, "a": [-98.15, 19.36], "d": 3, "color": "blanco"}],
         iconos=[{"en": "batallas", "lon": -97.9, "lat": 19.65, "cosa": "espada", "tam": 0.6}]),
    esc("y al final los tlaxcaltecas", "campamento", [
        act("jefe", "azteca", 1200, -0.5, [("cuentas", "piensa"), ("amigo", "asiente")], colores=TLXC),
        act("Cortés", "conquistador", 700, 0.5, [("enemigo", "saluda")])],
        bocadillos=[bo("amigo", "jefe", "¿Contra los mexicas? Trato hecho.", 420)]),
    mapa("Se unen a los españoles", [-98.6, 19.45, 5], [-98.8, 19.45, 4], "1519",
         capas=[{"en": 0, "id": "tlaxcala", "color": "verde", "op": 0.6}],
         ejercitos=[{"en": "Miles", "de": [-98.2, 19.3], "a": [-99.05, 19.4], "d": 3, "color": "verde"},
                    {"en": "unen", "de": [-98.25, 19.4], "a": [-99.05, 19.45], "d": 3, "color": "blanco"}],
         pins=[pin("Tenochtitlan", TEN, "Tenochtitlan", aro=True)]),

    # ---------------- 5. Moctezuma ----------------
    {"en": "Ahora vuelve al principio", "tipo": "capitulo", "numero": 5},
    esc("Noviembre de 1519. Los", "tenochtitlan", [
        act("Moctezuma", "azteca", 1250, -0.4, [("recibirlos", "saluda")], s=1.2, colores=MOC),
        act("Cortés", "conquistador", 650, 0.5, [("calzada", "camina"), ("persona", "quita_sombrero")])],
        rotulos=[fecha("Tenochtitlan, 8 de noviembre de 1519")]),
    esc("Les regala collares", "sala_trono", [
        act("Moctezuma", "azteca", 1210, -0.3, [("regala", "saluda")], sentado=True, y=710, colores=MOC),
        act("Cortés", "conquistador", 700, 0.5, [("collares", "celebra")])],
        cosas=[cosa("collares", "oro", 950, 640)],
        bocadillos=[bo("invitados", "Moctezuma", "Bienvenidos... supongo.")]),
    nar("Por qué? Nadie",
        {"en": "Por qué", "palabra": "¿Por qué?", "rojo": True},
        {"en": "certeza", "cosa": "pergamino", "pie": "Nadie lo sabe con certeza"}),
    nar("Quizá curiosidad",
        {"en": "curiosidad", "tarjeta": "¿Curiosidad?", "cosa": "libro"},
        {"en": "prudencia", "tarjeta": "¿Prudencia?", "cosa": "escudo"},
        {"en": "estudiar", "tarjeta": "¿Estudiarlos?", "cosa": "mapa_abierto"}),
    esc("Pero los invitados no", "sala_trono", [
        act("Moctezuma", "azteca", 1210, -0.3, [("rehén", "susto")], sentado=True, y=710, colores=MOC),
        act("s1", "conquistador", 760, 0.5, [("portan", "jarras")], lleva="espada"),
        act("Cortés", "conquistador", 1550, -0.5, [("rehén", "senala")])],
        cosas=[cosa("palacio", "cadenas", 1210, 520)],
        bocadillos=[bo("rehén", "Cortés", "Usted se queda aquí.")]),
    nar("El hombre más poderoso",
        {"en": "poderoso", "cosa": "corona", "pie": "Prisionero en su casa", "tachar_en": "prisionero"}),

    # ---------------- 6. 1520 ----------------
    {"en": "Primavera de 1520", "tipo": "capitulo", "numero": 6},
    mapa("Cortés tiene que salir", [-97.8, 19.6, 8], [-97.5, 19.6, 7], "1520", capas=[IMP()],
         ejercitos=[{"en": "salir", "de": TEN, "a": CEM, "d": 3, "color": "blanco"}],
         barcos=[{"en": "otros", "de": [-93, 21], "a": [-96.25, 19.5], "d": 3, "flota": 5, "color": "#1e1e1e"}],
         pins=[pin("salir", TEN, "Tenochtitlan"), pin("enfrentarse", CEM, "Cempoala")]),
    esc("Deja al mando", "campamento", [
        act("Cortés", "conquistador", 700, 0.5, [("Deja", "senala")]),
        act("Alvarado", "conquistador", 1200, -0.5, [("Alvarado", "orgulloso")], lleva="espada", colores={"color": "#b07a1e"})],
        bocadillos=[bo(0.3, "Cortés", "Nada de locuras, ¿eh?")],
        rotulos=[rot("Alvarado", "Pedro de Alvarado", 1200, 230, 66)]),
    esc("Durante una gran fiesta", "tenochtitlan", [
        act("n1", "azteca", 600, 0.4, [("bailaban", "celebra"), ("matanza", "cae")]),
        act("n2", "azteca", 880, 0.4, [("fiesta", "celebra"), ("desarmados", "susto")]),
        act("Alvarado", "conquistador", 1350, -0.5, [("atacan", "ataca")], lleva="espada")],
        humo=True, rotulos=[fecha("Templo Mayor, mayo de 1520")]),
    mapa("La ciudad entera se levanta", [-99.05, 19.45, 5], [-99.12, 19.43, 4], "1520",
         capas=[IMP()],
         pins=[pin(0, TEN, "Tenochtitlan", aro=True)],
         fuegos=[{"en": "armas", "lon": TEN[0], "lat": TEN[1]}],
         iconos=[{"en": "sitiados", "lon": TEN[0] + 0.35, "lat": TEN[1] + 0.25, "cosa": "espada", "tam": 0.5}]),
    nar("Moctezuma muere en esos",
        {"en": "Moctezuma", "cosa": "corona", "pie": "Muere Moctezuma", "tachar_en": "días"}),
    nar("Cómo murió",
        {"en": "piedras", "tarjeta": "¿Las piedras de su pueblo?", "cosa": "calavera"},
        {"en": "manos", "tarjeta": "¿Los españoles?", "cosa": "espada"},
        {"en": "discutiéndose", "palabra": "Todavía se discute", "rojo": True}),
    mapa("La noche del 30", [-99.1, 19.45, 4.5], [-99.2, 19.47, 3.5], "30 de junio de 1520",
         pins=[pin(0, TEN, "Tenochtitlan")],
         ejercitos=[{"en": "huir", "de": TEN, "a": [-99.45, 19.5], "d": 3, "color": "blanco"}]),
    esc("Los descubren", "laguna", [
        act("g1", "azteca", 1300, -0.5, [("descubren", "ataca")], lleva="escudo"),
        act("g2", "azteca", 1550, -0.5, [("canoas", "ataca")]),
        act("s1", "conquistador", 650, 0.5, [("descubren", "susto")], lleva="saco")], noche=True),
    esc("Muchos soldados se ahogan", "laguna", [
        act("s1", "conquistador", 900, 0.3, [("ahogan", "cae")], lleva="oro")], noche=True,
        cosas=[cosa("oro", "oro", 1250, 760), cosa("peso", "lingote", 650, 760)]),
    nar("Los españoles la llamaron",
        {"en": "Noche Triste", "palabra": "La Noche Triste", "rojo": True},
        {"en": "llamaron", "cosa": "calavera", "pie": "30 de junio de 1520"}),
    esc("Cuenta la leyenda que Cortés", "selva", [
        act("Cortés", "conquistador", 960, 0.1, [("lloró", "triste")], sentado=True)], noche=True,
        rotulos=[rot("leyenda", "Según la leyenda", 960, 230, 64)]),
    esc("Los mexicas han ganado", "tenochtitlan", [
        act("g1", "azteca", 760, 0.4, [("ganado", "celebra")], lleva="escudo"),
        act("g2", "azteca", 1150, -0.4, [("mexicas", "celebra")])]),
    nar("Pero entonces llega un",
        {"en": "invisible", "palabra": "Un enemigo invisible", "rojo": True},
        {"en": "entonces", "cosa": "calavera", "pie": "Nadie podía verlo"}),
    mapa("Entre los españoles venía", [-98.5, 19.3, 16], [-98.8, 19.3, 13], "1520",
         capas=[{"en": 0, "id": "imperio", "color": "rojo", "op": 0.55, "cara": "susto", "cara_en": "viruela"}],
         rotulos=[rot("viruela", "Viruela", 560, 300, 90, True)]),
    esc("En pocos meses", "laguna", [
        act("e1", "indigena", 700, 0.4, [("meses", "triste")]),
        act("e2", "campesina", 1000, 0.2, [("población", "agacha")]),
        act("e3", "anciano", 1300, -0.4, [("parte", "triste")])], humo=True,
        rotulos=[fecha("Tenochtitlan, 1520")]),
    nar("Entre los muertos está",
        {"en": "Cuitláhuac", "cosa": "corona", "pie": "Cuitláhuac"},
        {"en": "ochenta", "tarjeta": "80 días de reinado", "cosa": "reloj"}),
    esc("El último emperador", "sala_trono", [
        act("Cuauhtémoc", "azteca", 960, 0.1, [("guerrero", "orgulloso"), ("Cuauhtémoc", "mira_camara")],
            s=1.3, lleva="espada", colores=CUA)],
        rotulos=[rot("Cuauhtémoc", "Cuauhtémoc", 960, 220, 84)]),

    # ---------------- 7. 1521 ----------------
    {"en": "Mayo de 1521", "tipo": "capitulo", "numero": 7},
    mapa("Cortés regresa", [-98.6, 19.4, 5], [-98.8, 19.4, 4.5], "1521",
         capas=[{"en": 0, "id": "tlaxcala", "color": "verde", "op": 0.5}],
         ejercitos=[{"en": "regresa", "de": [-98.2, 19.32], "a": [-98.95, 19.45], "d": 3, "color": "blanco"}],
         pins=[pin(0, TEN, "Tenochtitlan")]),
    esc("En Tlaxcala ha mandado", "campamento", [
        act("carpintero", "indigena", 650, 0.5, [("construir", "levanta")], lleva="pico", colores=TLXC),
        act("Cortés", "conquistador", 1300, -0.5, [("bergantines", "orgulloso")])],
        cosas=[cosa("bergantines", "ancla", 960, 700)],
        rotulos=[rot("trece", "13 bergantines", 960, 230, 80, True)]),
    esc("Los desmontan pieza", "montana", [
        act("p1", "indigena", 520, 0.6, [("cargan", "camina")], lleva="saco", colores=TLXC),
        act("p2", "indigena", 860, 0.6, [("hombros", "camina")], lleva="barril", colores=TLXC),
        act("p3", "indigena", 1200, 0.6, [("montañas", "camina")], lleva="saco", colores=TLXC)],
        bocadillos=[bo("montañas", "p1", "¿Falta mucho?")]),
    nar("Barcos de guerra viajando",
        {"en": "tierra", "cosa": "galera", "pie": "Barcos de guerra… por tierra"},
        {"en": "mochila", "palabra": "En la mochila", "rojo": True}),
    mapa("Con ellos, y con", [-99.0, 19.45, 4.5], [-99.08, 19.44, 3.5], "1521",
         pins=[pin(0, TEN, "Tenochtitlan", aro=True)],
         barcos=[{"en": "Con ellos", "de": [-98.9, 19.5], "a": [-99.07, 19.44], "d": 2.5, "flota": 4, "color": "rojo"}],
         ejercitos=[{"en": "decenas", "de": [-99.45, 19.5], "a": [-99.18, 19.45], "d": 2.5, "color": "verde"},
                    {"en": "rodean", "de": [-99.05, 19.15], "a": [-99.12, 19.38], "d": 2.5, "color": "blanco"},
                    {"en": "rodean", "de": [-99.1, 19.75], "a": [-99.13, 19.48], "d": 2.5, "color": "verde"}],
         rotulos=[rot("rodean", "Tenochtitlan rodeada", 560, 300, 70, True)]),
    mapa("Cortan el acueducto", [-99.15, 19.43, 4], [-99.15, 19.43, 3.2], "1521",
         pins=[pin(0, TEN, "Tenochtitlan"), pin("Chapultepec", [-99.19, 19.42], "Chapultepec", izquierda=True)],
         flechas=[{"en": "acueducto", "de": [-99.19, 19.42], "a": [-99.135, 19.43], "color": "#3c7fd0"}],
         iconos=[{"en": "Cortan", "lon": -99.16, "lat": 19.5, "cosa": "cuenco", "tam": 0.5}],
         rotulos=[rot("acueducto", "Sin agua dulce", 560, 300, 80, True)]),
    esc("Sin agua dulce, sin", "tenochtitlan", [
        act("g1", "azteca", 650, 0.5, [("resiste", "ataca")], lleva="escudo"),
        act("s1", "conquistador", 1200, -0.5, [("calle", "ataca")], lleva="espada"),
        act("t1", "azteca", 1500, -0.5, [("casa", "ataca")], colores=TLXC)], humo=True,
        rotulos=[fecha("Asedio de Tenochtitlan, 1521")]),
    nar("casa por casa",
        {"en": "casa", "cifra": "3 meses", "sub": "de asedio", "icono": "reloj"}),
    esc("El 13 de agosto", "laguna", [
        act("Cuauhtémoc", "azteca", 1100, -0.3, [("capturado", "agacha")], colores=CUA),
        act("captor", "conquistador", 650, 0.5, [("capturado", "senala")], lleva="espada")],
        rotulos=[fecha("Tlatelolco, 13 de agosto de 1521")]),
    mapa("Tenochtitlan ha caído", [-99.2, 19.5, 9], [-99.15, 19.45, 6], "13 de agosto de 1521",
         capas=[{"en": 0, "id": "imperio", "color": "rojo", "op": 0.6, "cara": "muerto", "cara_en": "caído"}],
         fuegos=[{"en": 0, "lon": TEN[0], "lat": TEN[1], "tam": 1.3}]),

    # ---------------- Final ----------------
    esc("Sobre sus ruinas", "ciudad", [
        act("fraile", "monje", 700, 0.4, [("construyeron", "senala")], lleva="cruz"),
        act("albañil", "campesino", 1200, -0.4, [("piedras", "agacha")], lleva="pico")],
        cosas=[cosa("iglesias", "cruz", 960, 520)],
        rotulos=[fecha("Ciudad de México, siglo XVI")]),
    mapa("Y el lago, poco", [-99.05, 19.45, 5], [-99.1, 19.43, 4], "Hoy",
         pins=[pin(0, TEN, "Ciudad de México", aro=True)],
         rotulos=[rot("desecado", "El lago desapareció", 560, 300, 70, True)]),
    esc("Pero Tenochtitlan nunca", "calle", [
        act("o1", "obrero", 700, 0.4, [("cavaban", "agacha"), ("piedra", "susto")], lleva="pico"),
        act("o2", "obrero", 1150, -0.4, [("tallada", "senala")])],
        bocadillos=[bo("tallada", "o2", "Jefe... venga a ver esto.", 380)],
        rotulos=[fecha("Ciudad de México, 1978")]),
    nar("Debajo estaba el Templo",
        {"en": "Templo Mayor", "cosa": "piramide", "pie": "¡El Templo Mayor!"}),
    nar("Y cada vez que dices",
        {"en": "tomate", "palabra": "Tomate"},
        {"en": "aguacate", "palabra": "Aguacate"},
        {"en": "chile", "palabra": "Chile"},
        {"en": "náhuatl", "tarjeta": "Náhuatl", "cosa": "libro"}),
    mapa("El imperio cayó en dos", [-100, 22, 24], [-100.5, 22.5, 21], "Hoy",
         capas=[{"en": 0, "id": "imperio", "color": "rojo", "op": 0.5},
                {"en": "México", "id": "mexico_hoy", "color": "verde", "modo": "crece", "etiqueta": "México", "cara": "feliz", "cara_en": "México"}]),
]

plan = {
    "cola": 2,
    "capitulos": [
        "1325|Un islote que nadie quería|islote",
        "1428|El imperio|corona",
        "1500|La Venecia de América|piramide",
        "1519|Llegan los españoles|carabela",
        "1519|Moctezuma, prisionero|cadenas",
        "1520|La Noche Triste|calavera",
        "1521|La caída|fuego",
    ],
    "musica": [
        {"desde": 0, "pista": "epica--call-to-adventure.mp3"},
        {"desde": "Valle de México, hacia", "pista": "antigua--teller-of-the-tales.mp3"},
        {"desde": "Ahora, entremos", "pista": "curiosidad--investigations.mp3"},
        {"desde": "Año 1519. Un capitán", "pista": "epica--rising-tide.mp3"},
        {"desde": "Ahora vuelve al principio", "pista": "misterio--hidden-past.mp3"},
        {"desde": "Primavera de 1520", "pista": "guerra--impending-boom.mp3"},
        {"desde": "Entre los españoles venía", "pista": "triste--heavy-heart.mp3"},
        {"desde": "Mayo de 1521", "pista": "guerra--undaunted.mp3"},
        {"desde": "Sobre sus ruinas", "pista": "reflexion--rumination.mp3"},
    ],
    "planos": planos,
}
json.dump(plan, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
print(len(planos), "planos")
