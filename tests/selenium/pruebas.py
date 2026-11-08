"""
Pruebas con Selenium de toda la web de Konys Pizza (sitio del cliente + panel admin)
y generación de un informe HTML con resultados, métricas y capturas.

Uso (desde la raíz del repo):
    pip install -r tests/selenium/requirements.txt
    python tests/selenium/pruebas.py                 # Chrome sin ventana
    python tests/selenium/pruebas.py --ver           # con la ventana visible
    python tests/selenium/pruebas.py --externos      # también revisa los enlaces externos
    python tests/selenium/pruebas.py --salida otra/carpeta

Las pruebas corren siempre en MODO DEMOSTRACIÓN: el servidor local entrega
js/config.example.js cuando el navegador pide js/config.js, así nunca se tocan
los datos reales de Supabase. El informe queda en informe-selenium/informe.html.
"""
import argparse
import base64
import datetime as dt
import functools
import html
import http.server
import json
import os
import platform
import re
import socketserver
import sys
import threading
import time
import traceback
import urllib.request
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import (ElementClickInterceptedException, StaleElementReferenceException,
                                        TimeoutException, UnexpectedAlertPresentException)
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

RAIZ = Path(__file__).resolve().parents[2]
PUERTO = 5174
URL = f"http://localhost:{PUERTO}"
CLAVE_ADMIN = "konys2026"


# =============================================================================
# Servidor estático (igual que Vercel con cleanUrls), forzado a modo demo
# =============================================================================
def _reglas_vercel():
    try:
        conf = json.loads((RAIZ / "vercel.json").read_text(encoding="utf-8"))
        return [(r["source"], r["headers"]) for r in conf.get("headers", [])]
    except Exception:  # noqa: BLE001
        return []


class Servidor(http.server.SimpleHTTPRequestHandler):
    no_encontrados = []
    reglas = _reglas_vercel()

    def end_headers(self):
        # Mismos encabezados de seguridad que pone Vercel en producción (CSP, X-Frame-Options…)
        ruta = self.path.split("?")[0]
        for fuente, encabezados in self.reglas:
            if re.fullmatch(fuente, ruta):
                for h in encabezados:
                    self.send_header(h["key"], h["value"])
        super().end_headers()

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(RAIZ), **kw)

    def translate_path(self, path):
        p = path.split("?")[0].split("#")[0]
        # Igual que la carpeta publicar/ de Vercel: solo las páginas, css, js e imágenes
        publico = p in ("/", "/index.html", "/admin", "/admin.html") or             re.fullmatch(r"/css/[\w.-]+\.css|/js/[\w.-]+\.js|/img/[\w.-]+\.(jpe?g|png|webp|svg)", p)
        if not publico or p == "/js/config.example.js":
            return str(RAIZ / "__no_publicado__")
        if p == "/admin":
            path = "/admin.html"
        elif p == "/js/config.js":
            path = "/js/config.example.js"
        return super().translate_path(path)

    def send_error(self, code, *a, **kw):
        if code == 404:
            Servidor.no_encontrados.append(self.path)
        super().send_error(code, *a, **kw)

    def log_message(self, *a):
        pass


class ServidorHilos(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        pass  # Chrome corta conexiones keep-alive al cerrar pestañas: no es un error de la web


# =============================================================================
# Registro de casos de prueba
# =============================================================================
CASOS = []          # resultados en orden de ejecución
CAPTURAS = []       # (titulo, archivo, base64)
METRICAS = {}       # rendimiento, recursos, etc.
HALLAZGOS = []      # avisos de calidad (accesibilidad, SEO, enlaces…)
ERRORES_CONSOLA = []
ctx = {}            # estado compartido entre casos (driver, fechas…)


class Aviso(Exception):
    """El caso funciona pero hay algo mejorable: se reporta como advertencia."""


def caso(codigo, modulo, nombre, requisito=""):
    def deco(fn):
        @functools.wraps(fn)
        def envoltura():
            r = {"codigo": codigo, "modulo": modulo, "nombre": nombre, "requisito": requisito,
                 "estado": "ok", "detalle": "", "duracion": 0, "captura": None}
            t0 = time.perf_counter()
            try:
                detalle = fn()
                r["detalle"] = detalle or ""
            except Aviso as e:
                r["estado"], r["detalle"] = "aviso", str(e)
            except AssertionError as e:
                r["estado"], r["detalle"] = "fallo", str(e) or "La verificación no se cumplió"
            except Exception as e:  # noqa: BLE001
                r["estado"] = "error"
                r["detalle"] = f"{type(e).__name__}: {str(e).splitlines()[0] if str(e) else ''}"
                r["traza"] = traceback.format_exc(limit=3)
            r["duracion"] = round(time.perf_counter() - t0, 2)
            if r["estado"] in ("fallo", "error"):
                cerrar_alertas()
                r["captura"] = captura(f"{codigo} (falló)", f"fallo-{codigo}", completa=False)
            simbolo = {"ok": "OK   ", "aviso": "AVISO", "fallo": "FALLO", "error": "ERROR"}[r["estado"]]
            print(f"  [{simbolo}] {codigo} {nombre}" + (f" — {r['detalle']}" if r["detalle"] else ""))
            CASOS.append(r)
            recoger_consola()
        return envoltura
    return deco


# =============================================================================
# Utilidades de Selenium
# =============================================================================
def d():
    return ctx["driver"]


def esperar(css, timeout=8, visible=True):
    cond = EC.visibility_of_element_located if visible else EC.presence_of_element_located
    return WebDriverWait(d(), timeout).until(cond((By.CSS_SELECTOR, css)))


def esperar_que(fn, timeout=6, mensaje="tiempo de espera agotado"):
    try:
        # Las tablas se vuelven a dibujar tras cada cambio: se reintenta si un elemento quedó viejo
        return WebDriverWait(d(), timeout, ignored_exceptions=(StaleElementReferenceException, AssertionError)
                             ).until(lambda _: fn())
    except TimeoutException:
        raise AssertionError(mensaje)


def uno(css):
    return d().find_element(By.CSS_SELECTOR, css)


def todos(css):
    return d().find_elements(By.CSS_SELECTOR, css)


def contar(css):
    return len(todos(css))


def visible(css):
    els = todos(css)
    return bool(els) and els[0].is_displayed()


def js(script, *args):
    return d().execute_script(script, *args)


def clic(objetivo):
    el = uno(objetivo) if isinstance(objetivo, str) else objetivo
    limpiar_toast()
    js("arguments[0].scrollIntoView({block:'center'})", el)
    try:
        el.click()
    except ElementClickInterceptedException:
        js("arguments[0].click()", el)


def escribir(css, texto):
    el = uno(css)
    el.clear()
    el.send_keys(texto)
    return el


def poner_valor(css, valor):
    """Para inputs date/time: fija el valor y dispara los eventos como lo haría el usuario."""
    js("const e=document.querySelector(arguments[0]); e.value=arguments[1];"
       "e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));",
       css, valor)


def texto(css):
    return uno(css).text.strip()


def toast():
    return esperar_que(lambda: visible("#toast") and texto("#toast"), mensaje="no apareció el aviso (toast)")


def limpiar_toast():
    """Oculta el aviso anterior para no confundirlo con el que produzca la próxima acción."""
    js("const t=document.querySelector('#toast'); if(t){t.hidden=true; t.textContent='';}")


esperar_toast_oculto = limpiar_toast


def filtrar_reservas():
    clic("#form-filtros button[type=submit]")
    esperar_reservas()


def esperar_reservas():
    esperar_que(lambda: not todos("#tabla-reservas .cargando") and
                (todos("#tabla-reservas table") or todos("#tabla-reservas .vacio")),
                mensaje="la tabla de reservas no termina de cargar")


def cerrar_alertas():
    try:
        d().switch_to.alert.dismiss()
    except Exception:  # noqa: BLE001
        pass


def tamano(ancho, alto, movil=False):
    d().execute_cdp_cmd("Emulation.setDeviceMetricsOverride",
                        {"width": ancho, "height": alto, "deviceScaleFactor": 1, "mobile": movil})


def captura(titulo, nombre, completa=True):
    """Captura de pantalla (página completa vía CDP). Devuelve el índice en CAPTURAS."""
    try:
        params = {"format": "jpeg", "quality": 72}
        if completa:
            m = d().execute_cdp_cmd("Page.getLayoutMetrics", {})
            ancho = m["cssContentSize"]["width"]
            alto = min(m["cssContentSize"]["height"], 9000)
            params.update({"captureBeyondViewport": True,
                           "clip": {"x": 0, "y": 0, "width": ancho, "height": alto, "scale": 1}})
        datos = d().execute_cdp_cmd("Page.captureScreenshot", params)["data"]
        archivo = ctx["salida"] / "capturas" / f"{len(CAPTURAS) + 1:02d}-{nombre}.jpg"
        archivo.write_bytes(base64.b64decode(datos))
        CAPTURAS.append((titulo, archivo.name, datos))
        return len(CAPTURAS) - 1
    except UnexpectedAlertPresentException:
        cerrar_alertas()
    except Exception as e:  # noqa: BLE001
        print("    (no se pudo tomar la captura:", e, ")")
    return None


def recoger_consola():
    try:
        for entrada in d().get_log("browser"):
            msg = entrada.get("message", "")
            # El script de cdnjs lo inyecta a propósito SEG-04 para comprobar que la CSP lo bloquea
            if entrada.get("level") == "SEVERE" and "fonts.g" not in msg and "favicon" not in msg and "cdnjs.cloudflare.com" not in msg:
                ERRORES_CONSOLA.append({"pagina": d().current_url, "mensaje": msg})
    except Exception:  # noqa: BLE001
        pass


def ir(ruta, limpiar=False):
    d().get(URL + ruta)
    if limpiar:
        js("localStorage.clear(); sessionStorage.clear();")
        d().get(URL + ruta)


def fecha_rel(dias):
    return js("const x=new Date(); x.setDate(x.getDate()+arguments[0]); return Konys.util.fechaISO(x);", dias)


def abrir_fecha(fecha):
    if not todos(f'[data-fecha="{fecha}"]'):
        clic('[data-mes="1"]')
    clic(f'[data-fecha="{fecha}"]')
    esperar("#slots .slot")


def abrir_mesa(nombre):
    boton = d().find_element(By.XPATH, f'//article[contains(@class,"mesa")][.//h3[normalize-space()="{nombre}"]]//button[@data-mesa]')
    clic(boton)
    esperar("#modal-reserva:not([hidden])")


def fila(tabla_css, contiene):
    filas = [f for f in todos(f"{tabla_css} tbody tr") if contiene in f.text]
    assert filas, f'no se encontró la fila "{contiene}" en {tabla_css}'
    return filas[0]


def medir_carga(nombre):
    t = js("""const n = performance.getEntriesByType('navigation')[0];
      const r = performance.getEntriesByType('resource');
      return {ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, carga: n.loadEventEnd,
        recursos: r.length, peso: r.reduce((s, x) => s + (x.transferSize || x.encodedBodySize || 0), 0) + (n.transferSize || 0),
        rotos: r.filter(x => x.responseStatus >= 400).map(x => x.name)};""")
    METRICAS[nombre] = t
    return t


# =============================================================================
# 1. SITIO DEL CLIENTE — escritorio
# =============================================================================
@caso("CLI-01", "Cliente", "La página de inicio carga en modo demostración", "RNF")
def cli_carga():
    tamano(1440, 900)
    ir("/", limpiar=True)
    esperar(".mesa")
    assert "Konys Pizza" in d().title, f"título inesperado: {d().title}"
    assert visible("#banner-demo"), "no se ve el aviso de modo demostración"
    ctx["hoy"], ctx["manana"] = fecha_rel(0), fecha_rel(1)
    m = medir_carga("Inicio (escritorio)")
    captura("Inicio — escritorio (1440 px)", "inicio-escritorio")
    return f"título «{d().title}», cargada en {m['carga']:.0f} ms"


@caso("CLI-02", "Cliente", "El menú principal lleva a cada sección", "RNF-01")
def cli_menu():
    destinos = {a.get_attribute("href").split("#")[-1] for a in todos("#nav a[href^='#']")}
    faltan = [x for x in destinos if not todos(f"#{x}")]
    assert not faltan, f"anclas sin sección: {faltan}"
    clic('#nav a[href="#carta"]')
    esperar_que(lambda: js("return document.querySelector('#carta').getBoundingClientRect().top < 200"),
                mensaje="al pulsar «Carta» la página no bajó a la sección")
    return "anclas: " + ", ".join(sorted(destinos))


@caso("CLI-03", "Cliente", "Se muestran solo las mesas activas", "RF-01")
def cli_mesas():
    n = contar(".mesa")
    assert n == 8, f"se esperaban 8 mesas activas y hay {n}"
    assert "Mesa 9" not in [h.text for h in todos(".mesa h3")], "aparece la Mesa 9, que está inactiva"
    return f"{n} tarjetas de mesa"


@caso("CLI-04", "Cliente", "Filtro de mesas por zona (Terraza / Salón / Todas)", "RF-01")
def cli_filtro_zona():
    clic('#filtro-zona [data-zona="terraza"]')
    terraza = contar(".mesa")
    assert all("Terraza" in m.text for m in todos(".mesa")), "el filtro Terraza muestra mesas de otra zona"
    clic('#filtro-zona [data-zona="salon"]')
    salon = contar(".mesa")
    assert uno('#filtro-zona [data-zona="salon"]').get_attribute("aria-pressed") == "true", "el chip no queda marcado"
    clic('#filtro-zona [data-zona=""]')
    assert terraza == 4 and salon == 4, f"terraza={terraza}, salón={salon} (se esperaban 4 y 4)"
    return f"terraza {terraza}, salón {salon}, todas {contar('.mesa')}"


@caso("CLI-05", "Cliente", "La carta muestra precios y oculta platos no disponibles", "RF-07")
def cli_carta():
    platos = contar(".plato")
    assert platos == 13, f"se esperaban 13 platos visibles y hay {platos}"
    assert "Konys Vegetariana" not in uno("#carta-contenido").text, "se muestra un plato no disponible"
    precios = [p.text for p in todos(".plato__precio")]
    malos = [p for p in precios if not p.startswith("$")]
    assert not malos, f"precios con formato raro: {malos}"
    assert "$29.900" in precios, "el formato de precio en pesos no es el esperado ($29.900)"
    return f"{platos} platos, ej. {precios[0]}"


@caso("CLI-06", "Cliente", "Filtro de la carta por categoría", "RF-07")
def cli_filtro_carta():
    clic('#filtro-categoria [data-categoria="bebidas"]')
    bebidas = contar(".plato")
    grupos = [g.text for g in todos(".carta-grupo h3")]
    assert grupos == ["Bebidas"], f"grupos visibles con el filtro Bebidas: {grupos}"
    postres_visible = uno('#filtro-categoria [data-categoria="postres"]').is_displayed()
    clic('#filtro-categoria [data-categoria=""]')
    assert not postres_visible, "se muestra el filtro «Postres» aunque no hay postres en la carta"
    return f"Bebidas muestra {bebidas} platos; el chip Postres se oculta porque no hay postres"


@caso("CLI-07", "Cliente", "Todas las imágenes cargan", "RNF")
def cli_imagenes():
    js("document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
    esperar_que(lambda: js("return [...document.images].every(i => i.complete)"), 8, "hay imágenes que no terminan de cargar")
    rotas = js("return [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src'))")
    assert not rotas, f"imágenes rotas: {rotas}"
    return f"{js('return document.images.length')} imágenes cargadas"


@caso("CLI-08", "Cliente", "Abrir el flujo de reserva de una mesa", "RF-02")
def cli_abrir_reserva():
    abrir_mesa("Mesa 3")
    assert visible("#calendario"), "no se ve el calendario"
    assert "Mesa 3" in texto("#modal-titulo"), "el título del modal no corresponde a la mesa"
    assert "6 personas" in texto("#modal-meta"), "no muestra la capacidad de la mesa"
    assert uno("#btn-confirmar").get_attribute("disabled"), "el botón Confirmar está activo sin fecha ni hora"
    assert "paso--actual" in uno('.paso[data-paso="1"]').get_attribute("class"), "el indicador no marca el paso 1"
    return texto("#modal-titulo")


@caso("CLI-09", "Cliente", "Calendario: días pasados y fuera de rango deshabilitados", "RF-03")
def cli_calendario():
    r = js("""const U = Konys.util, ayer = new Date(), lim = new Date();
      ayer.setDate(ayer.getDate()-1); lim.setDate(lim.getDate()+31);
      const b = f => document.querySelector('[data-fecha="'+U.fechaISO(f)+'"]');
      return {ayer: !b(ayer) || b(ayer).disabled, hoy: !!document.querySelector('.dia--hoy'),
              lim: U.fechaISO(lim)};""")
    assert r["ayer"], "el día de ayer se puede elegir"
    assert r["hoy"], "no se marca el día de hoy"
    # Día 31 en adelante: debe estar deshabilitado (puede estar en el mes siguiente)
    if not todos(f'[data-fecha="{r["lim"]}"]') and todos('[data-mes="1"]:not([disabled])'):
        clic('[data-mes="1"]')
    lim = todos(f'[data-fecha="{r["lim"]}"]')
    assert not lim or lim[0].get_attribute("disabled"), f"se puede reservar el {r['lim']} (más de 30 días)"
    if todos('[data-mes="-1"]:not([disabled])'):
        clic('[data-mes="-1"]')
    return f"ayer deshabilitado, {r['lim']} fuera de rango"


@caso("CLI-10", "Cliente", "Horarios ocupados se ven como no disponibles", "RF-04")
def cli_slots_ocupados():
    abrir_fecha(ctx["manana"])
    assert uno('#slots .slot[data-slot="19:30"]').get_attribute("disabled"), "las 19:30 de mañana (reservada) aparece libre"
    titulos = [t.text for t in todos(".jornada-titulo")]
    assert titulos, "no hay títulos de jornada"
    assert "paso--actual" in uno('.paso[data-paso="2"]').get_attribute("class"), "el indicador no avanza al paso 2"
    libres = contar("#slots .slot:not([disabled])")
    return f"jornadas: {' | '.join(titulos)}; {libres} horarios libres"


@caso("CLI-11", "Cliente", "Hoy: las horas que ya pasaron no se pueden reservar", "RF-04")
def cli_slots_hoy():
    habil = todos(f'[data-fecha="{ctx["hoy"]}"]:not([disabled])')
    if not habil:
        return "hoy ya no quedan horarios (día deshabilitado, correcto)"
    clic(habil[0])
    esperar("#slots .slot")
    malos = js("""const ahora = new Date().getHours()*60 + new Date().getMinutes();
      return [...document.querySelectorAll('#slots .slot:not([disabled])')].map(b => b.dataset.slot)
        .filter(h => Konys.util.aMinutos(h) <= ahora);""")
    assert not malos, f"se pueden elegir horas pasadas: {malos}"
    abrir_fecha(ctx["manana"])
    return "ninguna hora pasada está habilitada"


@caso("CLI-12", "Cliente", "Validación: nombre vacío", "RF-05")
def cli_valida_nombre():
    clic('#slots .slot[data-slot="20:30"]')
    escribir("#r-personas", "2")
    clic("#btn-confirmar")
    assert visible("#e-nombre"), "no aparece el error de nombre"
    assert uno("#r-nombre").get_attribute("aria-invalid") == "true", "el campo no se marca como inválido"
    assert d().switch_to.active_element == uno("#r-nombre"), "el foco no va al campo con error"
    return texto("#e-nombre")


@caso("CLI-13", "Cliente", "Validación: más personas que la capacidad de la mesa", "CU-02")
def cli_valida_capacidad():
    escribir("#r-nombre", "Prueba Selenium")
    escribir("#r-personas", "9")
    clic("#btn-confirmar")
    assert visible("#e-personas"), "no aparece el error de capacidad"
    msg = texto("#e-personas")
    escribir("#r-personas", "0")
    clic("#btn-confirmar")
    assert visible("#e-personas"), "acepta 0 personas"
    escribir("#r-personas", "4")
    assert not visible("#e-personas"), "el error no se quita al corregir el campo"
    assert texto("#s-personas") == "4 personas", "el resumen no se actualiza con las personas"
    captura("Reserva con datos completos", "reserva-escritorio", completa=False)
    return msg


@caso("CLI-14", "Cliente", "Doble reserva: otra persona toma el horario antes de confirmar", "§12.2")
def cli_doble_reserva():
    js("""return (async () => {
      const m = (await Konys.datos.listarMesas()).find(x => x.nombre === 'Mesa 3');
      await Konys.datos.crearReserva({mesa_id: m.id, cliente_nombre: 'Otra persona', cliente_contacto: null,
        num_personas: 2, fecha: arguments[0], hora_inicio: '20:30', hora_fin: '21:30'});
    })()""", ctx["manana"])
    clic("#btn-confirmar")
    esperar("#alerta-slot .alerta--error")
    assert uno('#slots .slot[data-slot="20:30"]').get_attribute("disabled"), "el horario tomado no pasa a ocupado"
    captura("Error de horario recién ocupado", "reserva-doble", completa=False)
    return texto("#alerta-slot strong")


@caso("CLI-15", "Cliente", "Reserva exitosa y comprobante", "RF-05 / RF-06")
def cli_reserva_ok():
    clic('#slots .slot[data-slot="21:30"]')
    escribir("#r-contacto", "300 123 4567")
    clic("#btn-confirmar")
    esperar("#vista-confirmacion:not([hidden])")
    det = texto("#detalle-reserva")
    assert "Prueba Selenium" in det and "Mesa 3" in det and "300 123 4567" in det, f"comprobante incompleto: {det}"
    codigo = uno("#detalle-reserva dd").text
    assert codigo.startswith("KP-"), f"código de reserva inesperado: {codigo}"
    captura("Comprobante de reserva", "confirmacion", completa=False)
    return f"código {codigo}"


@caso("CLI-16", "Cliente", "El horario recién reservado queda ocupado", "RF-04")
def cli_slot_reservado():
    clic("#btn-volver")
    abrir_mesa("Mesa 3")
    abrir_fecha(ctx["manana"])
    assert uno('#slots .slot[data-slot="21:30"]').get_attribute("disabled"), "las 21:30 sigue libre después de reservarla"
    return "21:30 ocupado"


@caso("CLI-17", "Cliente", "El modal se cierra con Esc, con la X y al pulsar fuera", "RNF-01")
def cli_cerrar_modal():
    uno("body").send_keys(Keys.ESCAPE)
    assert not visible("#modal-reserva"), "Esc no cierra el modal"
    abrir_mesa("Mesa 1")
    clic("#modal-cerrar")
    assert not visible("#modal-reserva"), "la X no cierra el modal"
    abrir_mesa("Mesa 1")
    js("document.querySelector('#modal-reserva').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
    assert not visible("#modal-reserva"), "pulsar fuera no cierra el modal"
    assert js("return document.body.style.overflow") == "", "la página queda sin scroll tras cerrar"
    return "Esc, X y fondo"


@caso("CLI-18", "Seguridad", "Inyección de HTML: no se puede escribir y, si llega a la base, se muestra como texto", "RNF")
def cli_xss():
    abrir_mesa("Mesa 4")
    abrir_fecha(ctx["manana"])
    clic("#slots .slot:not([disabled])")
    v = teclear("#r-nombre", '<img src=x onerror="window.__xss=1">')
    assert "<" not in v and ">" not in v and "=" not in v, f"el campo aceptó HTML: {v}"
    assert visible("#e-nombre"), "no avisa que esos caracteres no se permiten"
    clic("#modal-cerrar")
    # Defensa en profundidad: un registro malicioso metido directo en los datos (saltándose todo)
    js("""const d = JSON.parse(localStorage.getItem('konys_demo_v2'));
      d.reservas.push({id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mesa_id: d.mesas[3].id,
        cliente_nombre: '<img src=x onerror="window.__xss=1">Hacker', cliente_contacto: '<b>x</b>', num_personas: 2,
        fecha: arguments[0], hora_inicio: '17:30', hora_fin: '18:30', estado: 'confirmada', creado_en: new Date().toISOString()});
      localStorage.setItem('konys_demo_v2', JSON.stringify(d));""", ctx["manana"])
    return f"el campo quedó en «{v}»; se dejó un registro con HTML para revisar el panel (ADM-07)"


# =============================================================================
# 1b. VALIDACIÓN DE CAMPOS — lo que haría un usuario (o un profesor) intentando romper el formulario
# =============================================================================
def teclear(css, texto):
    """Escribe tecla por tecla, como una persona, y devuelve lo que quedó en el campo."""
    el = uno(css)
    el.clear()
    el.send_keys(texto)
    return el.get_attribute("value")


def forzar(css, valor):
    """Pone un valor saltándose el filtro del teclado (como si se cambiara desde la consola del navegador)."""
    js("document.querySelector(arguments[0]).value = arguments[1]", css, valor)


def formulario_listo(mesa="Mesa 1"):
    ir("/")
    esperar(".mesa")
    abrir_mesa(mesa)
    abrir_fecha(ctx["manana"])
    clic("#slots .slot:not([disabled])")


def rechazos_formulario(boton, campo_error, casos, preparar=None):
    """Para cada valor: lo fuerza, envía y comprueba que aparezca el error y no se guarde nada."""
    aceptados = []
    for css, valor in casos:
        if preparar:
            preparar()
        forzar(css, valor)
        clic(boton)
        time.sleep(0.15)
        if not visible(campo_error(css)):
            aceptados.append(f"{css}={valor!r}")
    return aceptados


@caso("VAL-01", "Validación", "Personas: no deja escribir letras, signos ni decimales", "RF-05")
def val_personas_teclado():
    formulario_listo()
    pruebas = [("abc", ""), ("e", ""), ("-3", "3"), ("+4", "4"), ("2.5", "25"), ("2,5", "25"), ("1e1", "11"), ("123", "12")]
    malos = []
    for escrito, esperado in pruebas:
        v = teclear("#r-personas", escrito)
        if v != esperado:
            malos.append(f"«{escrito}» quedó «{v}»")
    teclear("#r-personas", "abc")
    assert visible("#e-personas"), "no avisa que solo se permiten números"
    aviso = texto("#e-personas")
    assert not malos, "; ".join(malos)
    return f"letras y signos bloqueados; aviso: «{aviso}»"


@caso("VAL-02", "Validación", "Personas: valores fuera de rango o manipulados se rechazan al confirmar", "RF-05")
def val_personas_envio():
    escribir("#r-nombre", "Ana Ruiz")
    casos = [("#r-personas", v) for v in ["", "abc", "1e1", "2.5", "-1", "0", "5", "999", " "]]
    aceptados = rechazos_formulario("#btn-confirmar", lambda c: "#e-personas", casos)
    assert not visible("#vista-confirmacion"), "se confirmó una reserva con datos inválidos"
    assert not aceptados, "se aceptaron: " + ", ".join(aceptados)
    return f"{len(casos)} valores rechazados (la Mesa 1 admite máximo 4)"


@caso("VAL-03", "Validación", "Nombre: sin números, HTML ni símbolos", "RF-05")
def val_nombre():
    escribir("#r-personas", "2")
    v1 = teclear("#r-nombre", "Juan123")
    v2 = teclear("#r-nombre", "<script>alert(1)</script>")
    assert v1 == "Juan", f"«Juan123» quedó «{v1}»"
    assert "<" not in v2 and "(" not in v2, f"el HTML quedó «{v2}»"
    casos = [("#r-nombre", v) for v in ["", "   ", "J", "1234", "Juan<b>", "Ana--María", "Pedro_Gómez", "José@", "A" * 81, "''..--"]]
    aceptados = rechazos_formulario("#btn-confirmar", lambda c: "#e-nombre", casos)
    assert not aceptados, "se aceptaron: " + ", ".join(aceptados)
    teclear("#r-nombre", "María José O'Brien")
    uno("#r-personas").click()
    assert not visible("#e-nombre"), "rechaza un nombre válido con tildes y apóstrofo"
    return f"{len(casos)} nombres inválidos rechazados; «María José O'Brien» aceptado"


@caso("VAL-04", "Validación", "Teléfono: no acepta correos, letras ni números incompletos", "RF-05")
def val_telefono():
    v1 = teclear("#r-contacto", "juan@correo.com")
    v2 = teclear("#r-contacto", "300abc1234567")
    assert v1 == "", f"el correo quedó escrito: «{v1}»"
    assert v2 == "3001234567", f"«300abc1234567» quedó «{v2}»"
    casos = [("#r-contacto", v) for v in ["juan@correo.com", "12345", "1234567890", "+1 305 123 4567", "300 123 45678",
                                          "30+0123456", "3000000000", "abc"]]
    aceptados = rechazos_formulario("#btn-confirmar", lambda c: "#e-contacto", casos)
    forzar("#r-nombre", "J")
    forzar("#r-personas", "abc")
    clic("#btn-confirmar")
    js("document.querySelector('#form-reserva').scrollIntoView()")
    captura("Validación — errores en el formulario de reserva", "validacion-reserva", completa=False)
    assert not aceptados, "se aceptaron: " + ", ".join(aceptados)
    norm = js("return ['+57 300 123 4567', '(607) 687-9020', '3001234567'].map(t => Konys.validar.telefono(t).valor)")
    assert norm == ["300 123 4567", "607 687 9020", "300 123 4567"], f"normalización: {norm}"
    return f"{len(casos)} teléfonos inválidos rechazados; válidos se guardan como {norm[0]}"


@caso("VAL-05", "Validación", "Errores al salir de cada campo, sin esperar a enviar", "RNF-01")
def val_blur():
    forzar("#r-contacto", "")
    teclear("#r-nombre", "J")
    uno("#r-contacto").click()
    a = visible("#e-nombre")
    forzar("#r-contacto", "123")
    uno("#r-personas").click()
    b = visible("#e-contacto")
    assert a and b, f"error del nombre al salir: {a}, del teléfono: {b}"
    return "el error aparece al pasar al siguiente campo"


@caso("VAL-06", "Validación", "Reserva con datos válidos en el límite (tildes, +57, capacidad máxima)", "RF-05")
def val_reserva_valida():
    teclear("#r-nombre", "  María   José O'Brien ")
    forzar("#r-contacto", "+57 300 123 4567")
    teclear("#r-personas", "4")
    clic("#btn-confirmar")
    esperar("#vista-confirmacion:not([hidden])")
    det = texto("#detalle-reserva")
    assert "María José O'Brien" in det, f"el nombre no se limpió de espacios: {det}"
    assert "300 123 4567" in det, f"el teléfono no se guardó normalizado: {det}"
    clic("#btn-volver")
    return "nombre sin espacios de más y teléfono como 300 123 4567"


@caso("VAL-07", "Seguridad", "Capa de datos: rechaza reservas manipuladas desde la consola", "RNF")
def val_api_reserva():
    r = js("""return (async () => {
      const m = (await Konys.datos.listarMesas()).find(x => x.nombre === 'Mesa 6');
      const f = arguments[0], ayer = Konys.util.fechaISO(new Date(Date.now() - 864e5));
      const lejos = Konys.util.fechaISO(new Date(Date.now() + 60 * 864e5));
      const base = {mesa_id: m.id, cliente_nombre: 'Prueba', cliente_contacto: null, num_personas: 2, fecha: f, hora_inicio: '16:30', hora_fin: '17:30'};
      const casos = {
        'nombre con HTML': {cliente_nombre: '<img src=x onerror=alert(1)>'},
        'nombre con números': {cliente_nombre: 'Juan 23'},
        'personas como texto': {num_personas: 'abc'},
        'personas "2"': {num_personas: '2'},
        'personas decimales': {num_personas: 2.5},
        'personas negativas': {num_personas: -4},
        'más que la capacidad': {num_personas: 5},
        'contacto con correo': {cliente_contacto: 'juan@correo.com'},
        'hora 03:00': {hora_inicio: '03:00', hora_fin: '04:00'},
        'hora 25:00': {hora_inicio: '25:00', hora_fin: '26:00'},
        'fin antes que inicio': {hora_inicio: '18:30', hora_fin: '17:30'},
        'fecha pasada': {fecha: ayer},
        'fecha a 60 días': {fecha: lejos},
        'fecha 30 de febrero': {fecha: '2027-02-30'},
        'mesa inexistente': {mesa_id: "1; drop table reservas"},
        'estado completada': {estado: 'completada'}
      };
      const out = {};
      for (const k in casos) {
        try { await Konys.datos.crearReserva(Object.assign({}, base, casos[k])); out[k] = 'ACEPTADA'; }
        catch (e) { out[k] = e.codigo || e.message; }
      }
      return out;
    })()""", ctx["manana"])
    aceptadas = [k for k, v in r.items() if v == "ACEPTADA"]
    assert not aceptadas, "se aceptaron: " + ", ".join(aceptadas)
    codigos = sorted(set(r.values()))
    return f"{len(r)} intentos rechazados ({', '.join(codigos)})"


# =============================================================================
# 2. SITIO DEL CLIENTE — móvil y tablet
# =============================================================================
@caso("RES-01", "Responsive", "Móvil (390 px): sin scroll horizontal", "RNF-02")
def res_movil():
    tamano(390, 844, movil=True)
    ir("/")
    esperar(".mesa")
    ancho = js("return document.documentElement.scrollWidth")
    m = medir_carga("Inicio (móvil)")
    captura("Inicio — móvil (390 px)", "inicio-movil")
    assert ancho <= 390, f"scrollWidth={ancho}px"
    return f"scrollWidth={ancho}px, carga {m['carga']:.0f} ms"


@caso("RES-02", "Responsive", "Móvil: el menú hamburguesa abre y cierra", "RNF-02")
def res_menu():
    assert not visible('#nav a[href="#carta"]'), "el menú se ve abierto sin pulsar el botón"
    clic("#nav-toggle")
    assert visible('#nav a[href="#carta"]'), "el menú no se abre"
    assert uno("#nav-toggle").get_attribute("aria-expanded") == "true", "aria-expanded no cambia"
    captura("Menú móvil abierto", "menu-movil", completa=False)
    clic('#nav a[href="#mesas"]')
    assert not visible('#nav a[href="#carta"]'), "el menú no se cierra al elegir una opción"
    return "abre, marca aria-expanded y se cierra"


@caso("RES-03", "Responsive", "Móvil: el flujo de reserva cabe en pantalla", "RNF-02")
def res_modal():
    abrir_mesa("Mesa 1")
    abrir_fecha(ctx["manana"])
    ancho = js("return document.querySelector('.modal__cuerpo').scrollWidth")
    captura("Reserva — móvil", "reserva-movil", completa=False)
    clic("#modal-cerrar")
    assert ancho <= 390, f"el modal mide {ancho}px"
    return f"scrollWidth del modal={ancho}px"


@caso("RES-04", "Responsive", "Tablet (768 px): sin scroll horizontal", "RNF-02")
def res_tablet():
    tamano(768, 1024, movil=True)
    ir("/")
    esperar(".mesa")
    ancho = js("return document.documentElement.scrollWidth")
    captura("Inicio — tablet (768 px)", "inicio-tablet")
    assert ancho <= 768, f"scrollWidth={ancho}px"
    return f"scrollWidth={ancho}px"


@caso("RES-05", "Responsive", "Botones táctiles de al menos 40 px en móvil", "RNF-02")
def res_tactil():
    tamano(390, 844, movil=True)
    ir("/")
    esperar(".mesa")
    chicos = js("""return [...document.querySelectorAll('button, .btn, .chip')]
      .filter(b => b.offsetParent && b.getBoundingClientRect().height < 40)
      .map(b => (b.textContent.trim() || b.getAttribute('aria-label') || b.className).slice(0, 30) + ' (' + Math.round(b.getBoundingClientRect().height) + 'px)');""")
    tamano(1440, 900)
    if chicos:
        HALLAZGOS.append(("Responsive", "Elementos táctiles de menos de 40 px de alto en móvil", ", ".join(sorted(set(chicos)))))
        raise Aviso(f"{len(chicos)} elementos bajos: " + ", ".join(sorted(set(chicos))[:5]))
    return "todos los botones visibles miden 40 px o más"


# =============================================================================
# 3. CALIDAD: accesibilidad, SEO y enlaces (las dos páginas)
# =============================================================================
REVISION_A11Y = """
const r = {};
r.lang = document.documentElement.lang;
r.titulo = document.title;
r.descripcion = (document.querySelector('meta[name=description]') || {}).content || '';
r.viewport = !!document.querySelector('meta[name=viewport]');
r.h1 = document.querySelectorAll('h1').length;
r.imgSinAlt = [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src'));
r.camposSinEtiqueta = [...document.querySelectorAll('input, select, textarea')].filter(e => {
  if (e.type === 'hidden') return false;
  if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby')) return false;
  if (e.id && document.querySelector('label[for="' + e.id + '"]')) return false;
  return !e.closest('label');
}).map(e => e.id || e.name || e.outerHTML.slice(0, 60));
r.botonesSinNombre = [...document.querySelectorAll('button, a')].filter(b =>
  !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).map(b => b.outerHTML.slice(0, 80));
const niveles = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.offsetParent || h.closest('[hidden]') === null).map(h => +h.tagName[1]);
r.saltosTitulos = niveles.filter((n, i) => i > 0 && n - niveles[i - 1] > 1).length;
r.idsRepetidos = [...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i);
r.enlacesNuevaVentanaSinNoopener = [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).length;
r.enlaces = [...document.querySelectorAll('a[href]')].map(a => ({href: a.getAttribute('href'), abs: a.href, texto: (a.textContent.trim() || a.getAttribute('aria-label') || '').slice(0, 50)}));
return r;
"""


def revisar_pagina(nombre, ruta):
    ir(ruta)
    time.sleep(0.4)
    r = js(REVISION_A11Y)
    ctx.setdefault("revisiones", {})[nombre] = r
    problemas = []
    if r["lang"] != "es":
        problemas.append(f"lang=«{r['lang']}»")
    if r["imgSinAlt"]:
        problemas.append(f"imágenes sin alt: {r['imgSinAlt']}")
    if r["camposSinEtiqueta"]:
        problemas.append(f"campos sin etiqueta: {r['camposSinEtiqueta']}")
    if r["botonesSinNombre"]:
        problemas.append(f"botones/enlaces sin nombre accesible: {len(r['botonesSinNombre'])}")
    if r["idsRepetidos"]:
        problemas.append(f"ids repetidos: {sorted(set(r['idsRepetidos']))}")
    return r, problemas


@caso("CAL-01", "Accesibilidad", "Inicio: idioma, textos alternativos, etiquetas y nombres accesibles", "RNF-03")
def cal_a11y_inicio():
    tamano(1440, 900)
    r, problemas = revisar_pagina("Inicio", "/")
    assert not problemas, "; ".join(problemas)
    if r["h1"] != 1:
        raise Aviso(f"hay {r['h1']} títulos h1 (lo recomendado es 1)")
    return f"{len(r['enlaces'])} enlaces y todos los campos con etiqueta"


@caso("CAL-02", "Accesibilidad", "Admin: idioma, etiquetas y nombres accesibles", "RNF-03")
def cal_a11y_admin():
    r, problemas = revisar_pagina("Admin", "/admin")
    assert not problemas, "; ".join(problemas)
    return "sin problemas en la pantalla de acceso y el panel"


@caso("CAL-03", "SEO", "Título, descripción y viewport en cada página", "RNF")
def cal_seo():
    rev = ctx["revisiones"]
    ini, adm = rev["Inicio"], rev["Admin"]
    assert ini["titulo"] and ini["viewport"] and adm["viewport"], "falta título o meta viewport"
    assert len(ini["descripcion"]) >= 50, "la meta description del inicio es muy corta o no existe"
    ir("/admin")
    robots = js("return (document.querySelector('meta[name=robots]')||{}).content || ''")
    assert "noindex" in robots, "el panel admin no tiene noindex (podría salir en Google)"
    if len(ini["descripcion"]) > 160:
        raise Aviso(f"la descripción mide {len(ini['descripcion'])} caracteres; Google corta en ~160")
    return f"descripción de {len(ini['descripcion'])} caracteres; admin con noindex"


@caso("CAL-04", "Enlaces", "Enlaces internos y recursos del sitio responden", "RNF")
def cal_enlaces_internos():
    vistos, rotos = set(), []
    for pag, r in ctx["revisiones"].items():
        for e in r["enlaces"]:
            h, abs_ = e["href"], e["abs"]
            if h.startswith("#"):
                continue
            if abs_.startswith(URL) and abs_ not in vistos:
                vistos.add(abs_)
                try:
                    urllib.request.urlopen(abs_.split("#")[0], timeout=5)
                except Exception as ex:  # noqa: BLE001
                    rotos.append(f"{h} ({ex})")
    rotos += [f"{p} (404 en el servidor)" for p in sorted(set(Servidor.no_encontrados)) if "favicon" not in p]
    for nombre, m in METRICAS.items():
        rotos += [f"{x} ({nombre})" for x in m.get("rotos", [])]
    assert not rotos, "rotos: " + "; ".join(rotos)
    return f"{len(vistos)} enlaces internos ok, ningún recurso 404"


@caso("CAL-05", "Enlaces", "Enlaces externos (WhatsApp, teléfono, mapas, redes)", "RNF")
def cal_enlaces_externos():
    ext = {}
    for r in ctx["revisiones"].values():
        for e in r["enlaces"]:
            if not e["abs"].startswith(URL) and not e["href"].startswith("#"):
                ext[e["abs"]] = e["texto"]
    ctx["externos"] = ext
    formato = [u for u in ext if not (u.startswith("https://") or u.startswith("tel:") or u.startswith("mailto:"))]
    assert not formato, f"enlaces externos sin https: {formato}"
    if not ctx["args"].externos:
        return f"{len(ext)} enlaces con formato válido (no se abrieron; usa --externos)"
    caidos = []
    for u in ext:
        if not u.startswith("https://"):
            continue
        try:
            req = urllib.request.Request(u, method="GET", headers={"User-Agent": "Mozilla/5.0 (pruebas Konys)"})
            urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as ex:
            if ex.code not in (403, 429):  # redes sociales bloquean bots
                caidos.append(f"{u} → {ex.code}")
        except Exception as ex:  # noqa: BLE001
            caidos.append(f"{u} → {type(ex).__name__}")
    if caidos:
        raise Aviso("no respondieron: " + "; ".join(caidos))
    return f"{len(ext)} enlaces externos responden"


@caso("CAL-06", "Rendimiento", "La página de inicio carga en menos de 3 segundos", "RNF-04")
def cal_rendimiento():
    tamano(1440, 900)
    tiempos = []
    for _ in range(3):
        ir("/")
        esperar(".mesa")
        time.sleep(0.2)
        tiempos.append(medir_carga("Inicio (escritorio)")["carga"])
    ir("/admin")
    time.sleep(0.3)
    adm = medir_carga("Admin")
    prom = sum(tiempos) / len(tiempos)
    METRICAS["Inicio (escritorio)"]["promedio"] = prom
    assert prom < 3000, f"promedio {prom:.0f} ms"
    peso = METRICAS["Inicio (escritorio)"]["peso"] / 1024
    if peso > 1500:
        raise Aviso(f"carga en {prom:.0f} ms pero pesa {peso:.0f} KB")
    return f"promedio {prom:.0f} ms (3 cargas), {peso:.0f} KB; admin {adm['carga']:.0f} ms"


# =============================================================================
# 4. PANEL DE ADMINISTRACIÓN
# =============================================================================
@caso("ADM-01", "Admin", "Sin sesión, el panel está oculto", "RF-08")
def adm_sin_sesion():
    tamano(1440, 900)
    js("sessionStorage.clear()")
    ir("/admin")
    time.sleep(0.4)
    assert visible("#acceso") and not visible("#panel"), "se ve el panel sin iniciar sesión"
    assert visible("#banner-demo"), "no se ve el aviso de modo demo"
    return "solo se ve la pantalla de acceso"


@caso("ADM-02", "Admin", "Contraseña vacía o con tildes muestra un error", "RF-08")
def adm_clave_vacia():
    clic("#btn-ingresar")
    assert visible("#e-clave"), "no avisa que falta la contraseña"
    vacia = texto("#e-clave")
    escribir("#clave", "contraseña")
    clic("#btn-ingresar")
    tilde = texto("#e-clave")
    assert "tildes" in tilde, f"no avisa de las tildes: {tilde}"
    return f"«{vacia}» / «{tilde}»"


@caso("ADM-03", "Admin", "Contraseña incorrecta es rechazada", "RF-08")
def adm_clave_mala():
    escribir("#clave", "incorrecta")
    clic("#btn-ingresar")
    esperar_que(lambda: "incorrecta" in texto("#e-clave").lower(), mensaje="no muestra «contraseña incorrecta»")
    assert not visible("#panel"), "entra al panel con una clave incorrecta"
    captura("Acceso admin — contraseña incorrecta", "admin-acceso-error", completa=False)
    return texto("#e-clave")


@caso("ADM-04", "Admin", "Contraseña correcta abre el panel en Reservas", "RF-08")
def adm_login():
    escribir("#clave", CLAVE_ADMIN)
    clic("#btn-ingresar")
    esperar("#tabla-reservas table")
    assert visible("#sec-reservas"), "no abre la sección de reservas"
    assert uno('[data-seccion="reservas"]').get_attribute("aria-current") == "page", "el menú no marca la sección"
    return "panel visible"


@caso("ADM-05", "Admin", "La sesión se mantiene al recargar la página", "RF-08")
def adm_recarga():
    d().refresh()
    esperar("#tabla-reservas table")
    return "sigue dentro del panel tras recargar"


CLAVES_PROHIBIDAS = [CLAVE_ADMIN, "admin_hash'", "service_role", "sb_secret_", "x-admin-clave"]


@caso("SEG-01", "Seguridad", "El código que recibe el navegador no tiene contraseñas ni claves secretas", "RNF-05")
def seg_codigo_fuente():
    archivos = ["/", "/admin", "/css/styles.css", "/js/config.js", "/js/validacion.js", "/js/supabase.js", "/js/cliente.js", "/js/admin.js"]
    hallados = []
    for a in archivos:
        cuerpo = urllib.request.urlopen(URL + a, timeout=5).read().decode("utf-8", "replace")
        for clave in CLAVES_PROHIBIDAS:
            if clave in cuerpo:
                hallados.append(f"«{clave}» en {a}")
        if re.search(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.", cuerpo):
            hallados.append(f"un token JWT en {a}")
    assert not hallados, "; ".join(hallados)
    return f"{len(archivos)} archivos revisados: sin contraseñas, hashes ni claves de servicio"


@caso("SEG-02", "Seguridad", "Con la sesión abierta, el navegador no guarda la contraseña", "RNF-05")
def seg_almacenamiento():
    datos = js("""return {
      local: JSON.stringify(Object.assign({}, localStorage)),
      sesion: JSON.stringify(Object.assign({}, sessionStorage)),
      cookies: document.cookie,
      dom: document.documentElement.outerHTML,
      campo: document.querySelector('#clave').value};""")
    donde = [k for k in ("local", "sesion", "cookies", "dom", "campo") if CLAVE_ADMIN in datos[k]]
    assert not donde, f"la contraseña aparece en: {donde}"
    ses = json.loads(js("return sessionStorage.getItem('konys_admin_sesion')") or "{}")
    assert set(ses) == {"token", "expira"}, f"la sesión guarda otros datos: {list(ses)}"
    assert re.fullmatch(r"[0-9a-f-]{36}", ses["token"]), "el token no es un identificador aleatorio"
    return "solo hay un token aleatorio con su hora de vencimiento"


@caso("SEG-03", "Seguridad", "La sesión dura 10 minutos y se ve la cuenta regresiva", "RNF-05")
def seg_duracion():
    seg = js("return Konys.segundosSesionAdmin()")
    assert 540 <= seg <= 600, f"a la sesión le quedan {seg} s (se esperaban 10 minutos)"
    cuenta = esperar_que(lambda: texto("#sesion-restante"), mensaje="no se muestra el tiempo restante")
    assert cuenta.startswith("Sesión: 9:") or cuenta.startswith("Sesión: 10:"), f"indicador: {cuenta}"
    return f"quedan {seg} s; el panel muestra «{cuenta}»"


@caso("SEG-04", "Seguridad", "Encabezados de seguridad (CSP, anti-iframe, sin caché en el admin)", "RNF")
def seg_encabezados():
    h = urllib.request.urlopen(URL + "/admin", timeout=5).headers
    csp = h.get("Content-Security-Policy", "")
    faltan = [x for x in ["script-src 'self'", "frame-ancestors 'none'", "object-src 'none'"] if x not in csp]
    assert not faltan, f"a la CSP le falta: {faltan}"
    assert h.get("X-Frame-Options") == "DENY", "falta X-Frame-Options: DENY"
    assert h.get("X-Content-Type-Options") == "nosniff", "falta X-Content-Type-Options"
    assert "no-store" in (h.get("Cache-Control") or ""), "el admin se puede guardar en caché"
    bloqueado = js("""return new Promise(r => {
      document.addEventListener('securitypolicyviolation', e => r(e.violatedDirective.indexOf('script-src') === 0), {once: true});
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js';
      s.onload = () => r(false);
      document.head.appendChild(s);
      setTimeout(() => r(false), 4000);
    })""")
    assert bloqueado, "la página dejó cargar un script de otro sitio"
    return "CSP, X-Frame-Options, nosniff, no-store; un script externo inyectado queda bloqueado"


@caso("SEG-09", "Seguridad", "Los archivos internos del proyecto no se pueden abrir desde el navegador", "RNF")
def seg_archivos_internos():
    internos = ["/README.md", "/package.json", "/vercel.json", "/.env", "/.env.example", "/supabase/esquema.sql",
                "/supabase/seguridad.sql", "/tests/e2e.js", "/tests/db-pruebas.sql", "/scripts/generar-config.js",
                "/js/config.example.js", "/.git/config", "/docs/Documento-Proyecto.pdf", "/img/CREDITOS.md"]
    visibles = []
    for ruta in internos:
        try:
            urllib.request.urlopen(URL + ruta, timeout=5)
            visibles.append(ruta)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                visibles.append(f"{ruta} ({e.code})")
    Servidor.no_encontrados.clear()
    assert not visibles, "se pueden abrir: " + ", ".join(visibles)
    return f"{len(internos)} archivos internos responden 404 (README, .sql, pruebas, .env, .git…)"


@caso("ADM-06", "Admin", "Lista de reservas (incluye las hechas desde el sitio)", "RF-12")
def adm_reservas():
    filas = contar("#tabla-reservas tbody tr")
    tabla = texto("#tabla-reservas")
    assert filas >= 12, f"solo {filas} reservas"
    assert "Prueba Selenium" in tabla, "no aparece la reserva hecha en CLI-15"
    assert "María José O'Brien" in tabla and "300 123 4567" in tabla, "no aparece la reserva de VAL-06"
    captura("Admin — reservas", "admin-reservas")
    return f"{filas} reservas; {texto('#conteo-reservas')}"


@caso("ADM-07", "Seguridad", "El panel muestra como texto el nombre con HTML (sin XSS)", "RNF")
def adm_xss():
    assert not js("return window.__xss"), "se ejecutó el script inyectado en el panel"
    assert "<img" in texto("#tabla-reservas"), "el nombre con HTML no se muestra literal"
    return "escapado correctamente"


@caso("ADM-08", "Admin", "Filtros de reservas por fecha, mesa y estado", "RF-12")
def adm_filtros():
    total = contar("#tabla-reservas tbody tr")
    poner_valor("#f-fecha", ctx["manana"])
    filtrar_reservas()
    por_fecha = contar("#tabla-reservas tbody tr")
    fecha_corta = "/".join(reversed(ctx["manana"].split("-")))
    assert 0 < por_fecha < total, f"el filtro por fecha deja {por_fecha} de {total}"
    assert all(fecha_corta in f.text for f in todos("#tabla-reservas tbody tr")), "el filtro por fecha deja otras fechas"
    Select(uno("#f-mesa")).select_by_visible_text("Mesa 3")
    filtrar_reservas()
    por_mesa = contar("#tabla-reservas tbody tr")
    assert por_mesa and all("Mesa 3" in f.text for f in todos("#tabla-reservas tbody tr")), "el filtro por mesa deja otras mesas"
    clic("#btn-limpiar")
    esperar_reservas()
    Select(uno("#f-estado")).select_by_value("cancelada")
    filtrar_reservas()
    badges = [b.text for b in todos("#tabla-reservas tbody .badge")]
    assert badges and all(b == "Cancelada" for b in badges), f"filtro por estado: {badges}"
    clic("#btn-limpiar")
    esperar_que(lambda: contar("#tabla-reservas tbody tr") == total, mensaje="«Limpiar» no restaura la lista")
    return f"mañana → {por_fecha}, + Mesa 3 → {por_mesa}, canceladas → {len(badges)} (de {total})"


@caso("ADM-09", "Admin", "Cambiar el estado de una reserva", "RF-12")
def adm_estado_reserva():
    f = fila("#tabla-reservas", "Juan Pérez")
    Select(f.find_element(By.CSS_SELECTOR, "select")).select_by_value("completada")
    msg = toast()
    esperar_que(lambda: fila("#tabla-reservas", "Juan Pérez").find_element(By.CSS_SELECTOR, ".badge").text == "Completada",
                mensaje="la etiqueta no cambia a Completada")
    return msg


@caso("ADM-10", "Admin", "Listado de mesas (incluye inactivas)", "RF-10")
def adm_mesas():
    clic('[data-seccion="mesas"]')
    esperar("#tabla-mesas table")
    n = contar("#tabla-mesas tbody tr")
    assert n == 9, f"se esperaban 9 mesas y hay {n}"
    assert fila("#tabla-mesas", "Mesa 9").find_element(By.CSS_SELECTOR, ".badge").text == "Inactiva"
    return texto("#conteo-mesas")


@caso("ADM-11", "Admin", "Nueva mesa: validación de nombre y capacidad", "RF-09")
def adm_mesa_validacion():
    clic("#btn-nueva-mesa")
    esperar("#modal-mesa:not([hidden])")
    escribir("#m-capacidad", "50")
    clic("#form-mesa button[type=submit]")
    assert visible("#e-m-nombre") and visible("#e-m-capacidad"), "no muestra los dos errores"
    captura("Admin — validación de mesa", "admin-mesa-validacion", completa=False)
    return f"«{texto('#e-m-nombre')}» / «{texto('#e-m-capacidad')}»"


@caso("ADM-12", "Admin", "Registrar una mesa nueva", "RF-09")
def adm_mesa_nueva():
    escribir("#m-nombre", "Mesa 10")
    Select(uno("#m-zona")).select_by_value("salon")
    escribir("#m-capacidad", "5")
    clic("#form-mesa button[type=submit]")
    msg = toast()
    esperar_que(lambda: contar("#tabla-mesas tbody tr") == 10, mensaje="la mesa nueva no aparece en la tabla")
    return msg


@caso("ADM-13", "Admin", "Editar una mesa", "RF-09")
def adm_mesa_editar():
    clic(fila("#tabla-mesas", "Mesa 10").find_element(By.CSS_SELECTOR, '[data-accion="editar-mesa"]'))
    esperar("#modal-mesa:not([hidden])")
    assert uno("#m-nombre").get_attribute("value") == "Mesa 10", "el formulario no trae los datos de la mesa"
    escribir("#m-capacidad", "6")
    clic("#form-mesa button[type=submit]")
    toast()
    esperar_que(lambda: "6 personas" in fila("#tabla-mesas", "Mesa 10").text, mensaje="no se guarda la nueva capacidad")
    return "capacidad 5 → 6"


@caso("ADM-14", "Admin", "Desactivar una mesa", "RF-13")
def adm_mesa_desactivar():
    clic(fila("#tabla-mesas", "Mesa 2").find_element(By.CSS_SELECTOR, ".toggle"))
    esperar_que(lambda: fila("#tabla-mesas", "Mesa 2").find_element(By.CSS_SELECTOR, ".badge").text == "Inactiva",
                mensaje="la Mesa 2 no queda inactiva")
    return toast()


@caso("ADM-15", "Admin", "Filtro de mesas por zona", "RF-10")
def adm_mesa_filtro():
    clic('#filtro-mesas [data-zona="salon"]')
    zonas = {f.find_elements(By.TAG_NAME, "td")[1].text for f in todos("#tabla-mesas tbody tr")}
    clic('#filtro-mesas [data-zona=""]')
    assert zonas == {"Salón"}, f"zonas con el filtro Salón: {zonas}"
    return "solo salón"


@caso("ADM-16", "Admin", "Borrar mesa: pide confirmación y protege mesas con reservas", "RF-09")
def adm_mesa_borrar():
    esperar_toast_oculto()
    clic(fila("#tabla-mesas", "Mesa 3").find_element(By.CSS_SELECTOR, '[data-accion="borrar-mesa"]'))
    d().switch_to.alert.accept()
    protegida = toast()
    assert "reservas" in protegida, f"se pudo borrar una mesa con reservas: {protegida}"
    clic(fila("#tabla-mesas", "Mesa 10").find_element(By.CSS_SELECTOR, '[data-accion="borrar-mesa"]'))
    d().switch_to.alert.dismiss()
    time.sleep(0.3)
    assert contar("#tabla-mesas tbody tr") == 10, "borró la mesa aunque se canceló la confirmación"
    clic(fila("#tabla-mesas", "Mesa 10").find_element(By.CSS_SELECTOR, '[data-accion="borrar-mesa"]'))
    d().switch_to.alert.accept()
    esperar_que(lambda: contar("#tabla-mesas tbody tr") == 9, mensaje="no se borró la Mesa 10")
    captura("Admin — mesas", "admin-mesas")
    return "cancelar no borra; con reservas se bloquea; sin reservas se borra"


@caso("VAL-08", "Validación", "Admin · mesa: capacidad, nombre y URL de foto", "RF-09")
def val_admin_mesa():
    clic("#btn-nueva-mesa")
    esperar("#modal-mesa:not([hidden])")
    v1 = teclear("#m-capacidad", "abc")
    v2 = teclear("#m-capacidad", "-2.5")
    v3 = teclear("#m-nombre", "<b>Mesa</b>")
    assert v1 == "" and v2 == "25", f"capacidad: «abc»→«{v1}», «-2.5»→«{v2}»"
    assert "<" not in v3, f"el nombre aceptó HTML: {v3}"

    def preparar():
        forzar("#m-nombre", "Mesa Validación")
        forzar("#m-capacidad", "4")
        forzar("#m-foto", "")
    err = {"#m-nombre": "#e-m-nombre", "#m-capacidad": "#e-m-capacidad", "#m-foto": "#e-m-foto"}
    casos = [("#m-capacidad", v) for v in ["", "0", "31", "abc", "1e1", "4.5"]] + \
            [("#m-nombre", v) for v in ["", "x", "<b>Mesa</b>", "Mesa 1", "MESA 1", "mesa  1 ", "Mesa{1}"]] + \
            [("#m-foto", v) for v in ["javascript:alert(1)", "http://sitio.com/a.jpg", "https://sitio", "https://sitio.com/a b.jpg",
                                      "foto.jpg", 'https://x.com/"onerror=alert(1)']]
    antes = contar("#tabla-mesas tbody tr")
    aceptados = rechazos_formulario("#form-mesa button[type=submit]", lambda c: err[c], casos, preparar)
    forzar("#m-nombre", "MESA 1")
    forzar("#m-capacidad", "31")
    forzar("#m-foto", "javascript:alert(1)")
    clic("#form-mesa button[type=submit]")
    captura("Validación — errores al crear una mesa", "validacion-mesa", completa=False)
    clic("#modal-mesa [data-cerrar]")
    assert contar("#tabla-mesas tbody tr") == antes, "se guardó alguna mesa inválida"
    assert not aceptados, "se aceptaron: " + ", ".join(aceptados)
    return f"{len(casos)} valores inválidos rechazados (incluye nombre repetido «MESA 1»)"


@caso("VAL-09", "Validación", "Admin · plato: precio, nombre y descripción", "RF-14")
def val_admin_plato():
    clic('[data-seccion="carta"]')
    esperar("#tabla-platos table")
    clic("#btn-nuevo-plato")
    esperar("#modal-plato:not([hidden])")
    v1 = teclear("#p-precio", "abc")
    v2 = teclear("#p-precio", "$29.900")
    v3 = teclear("#p-descripcion", "<script>x</script>")
    assert v1 == "" and v2 == "29900", f"precio: «abc»→«{v1}», «$29.900»→«{v2}»"
    assert "<" not in v3 and ">" not in v3, f"la descripción aceptó HTML: {v3}"

    def preparar():
        forzar("#p-nombre", "Plato Validación")
        forzar("#p-precio", "30000")
        forzar("#p-descripcion", "")
    err = {"#p-nombre": "#e-p-nombre", "#p-precio": "#e-p-precio", "#p-descripcion": "#e-p-descripcion"}
    casos = [("#p-precio", v) for v in ["", "0", "50", "2000000", "-100", "1e5", "29.900", "veinte"]] + \
            [("#p-nombre", v) for v in ["", "<img src=x>", "Pan de ajo", "PAN DE AJO", "Pizza {x}"]] + \
            [("#p-descripcion", v) for v in ["<b>hola</b>", "a" * 161, "12"]]
    antes = contar("#tabla-platos tbody tr")
    aceptados = rechazos_formulario("#form-plato button[type=submit]", lambda c: err[c], casos, preparar)
    clic("#modal-plato [data-cerrar]")
    assert contar("#tabla-platos tbody tr") == antes, "se guardó algún plato inválido"
    assert not aceptados, "se aceptaron: " + ", ".join(aceptados)
    return f"{len(casos)} valores inválidos rechazados (incluye nombre repetido «PAN DE AJO»)"


@caso("VAL-10", "Validación", "Admin · horarios: duración con letras, vacía o que no va de 15 en 15", "RF-11")
def val_admin_horario():
    clic('[data-seccion="horarios"]')
    esperar("#tabla-horarios table")
    campo = 'input[data-campo="duracion_slot"]'
    v = teclear(campo, "abc")
    assert v == "", f"la duración aceptó letras: {v}"
    malos = []
    for valor in ["", "17", "0", "500", "10"]:
        limpiar_toast()
        forzar(campo, valor)
        js("document.querySelector(arguments[0]).dispatchEvent(new Event('change', {bubbles: true}))", campo)
        clic("#btn-guardar-horarios")
        try:
            msg = toast()
        except AssertionError:
            msg = ""
        if "Horarios guardados" in msg or not msg:
            malos.append(f"{valor!r} → «{msg}»")
    guardado = js("return (async () => (await Konys.datos.listarHorarios()).map(h => h.duracion_slot))()")
    d().refresh()
    esperar("#tabla-horarios table")
    assert not malos, "se aceptaron: " + "; ".join(malos)
    assert all(isinstance(x, int) and x % 15 == 0 for x in guardado), f"se guardaron duraciones inválidas: {guardado}"
    return "letras bloqueadas; vacía, 0, 10, 17 y 500 rechazadas"


@caso("VAL-11", "Seguridad", "Capa de datos del admin: rechaza mesas, platos y horarios manipulados", "RNF")
def val_api_admin():
    r = js("""return (async () => {
      const D = Konys.datos, h = (await D.listarHorarios())[0], res = (await D.listarReservas())[0];
      const mesa = {nombre: 'Mesa API', zona: 'salon', capacidad: 4, foto_url: null, activa: true};
      const plato = {nombre: 'Plato API', categoria: 'pizzas', descripcion: null, precio: 30000, disponible: true};
      const casos = {
        'mesa con HTML': () => D.crearMesa(Object.assign({}, mesa, {nombre: '<img src=x onerror=alert(1)>'})),
        'mesa capacidad 0': () => D.crearMesa(Object.assign({}, mesa, {capacidad: 0})),
        'mesa capacidad "5"': () => D.crearMesa(Object.assign({}, mesa, {capacidad: '5'})),
        'mesa zona cocina': () => D.crearMesa(Object.assign({}, mesa, {zona: 'cocina'})),
        'mesa foto javascript:': () => D.crearMesa(Object.assign({}, mesa, {foto_url: 'javascript:alert(1)'})),
        'mesa nombre repetido': () => D.crearMesa(Object.assign({}, mesa, {nombre: 'mesa 1'})),
        'plato precio negativo': () => D.crearPlato(Object.assign({}, plato, {precio: -1})),
        'plato precio decimal': () => D.crearPlato(Object.assign({}, plato, {precio: 2.5})),
        'plato categoría sopas': () => D.crearPlato(Object.assign({}, plato, {categoria: 'sopas'})),
        'plato descripción HTML': () => D.crearPlato(Object.assign({}, plato, {descripcion: '<script>x</script>'})),
        'horario duración 7': () => D.actualizarHorario(h.id, {duracion_slot: 7}),
        'horario hora 99:00': () => D.actualizarHorario(h.id, {hora_inicio: '99:00'}),
        'reserva estado pagada': () => D.actualizarReserva(res.id, {estado: 'pagada'}),
        'reserva sin datos': () => D.actualizarReserva(res.id, null)
      };
      const out = {};
      for (const k in casos) {
        try { await casos[k](); out[k] = 'ACEPTADA'; } catch (e) { out[k] = e.codigo || e.message; }
      }
      return out;
    })()""")
    aceptadas = [k for k, v in r.items() if v == "ACEPTADA"]
    assert not aceptadas, "se aceptaron: " + ", ".join(aceptadas)
    return f"{len(r)} intentos rechazados ({', '.join(sorted(set(r.values())))})"


@caso("ADM-17", "Admin", "Horarios: 13 jornadas (domingo sin almuerzo)", "RF-11")
def adm_horarios():
    clic('[data-seccion="horarios"]')
    esperar("#tabla-horarios table")
    n = contar("#tabla-horarios tbody tr")
    assert n == 13, f"hay {n} jornadas"
    assert uno("#btn-guardar-horarios").get_attribute("disabled"), "«Guardar» activo sin cambios"
    return f"{n} jornadas"


@caso("ADM-18", "Admin", "Editar la duración de una jornada y guardar", "RF-11")
def adm_horario_editar():
    campo = todos('#tabla-horarios tbody tr')[0].find_element(By.CSS_SELECTOR, 'input[data-campo="duracion_slot"]')
    campo.clear()
    campo.send_keys("30", Keys.TAB)
    assert "fila-cambiada" in todos('#tabla-horarios tbody tr')[0].get_attribute("class"), "la fila no se marca como cambiada"
    clic("#btn-guardar-horarios")
    toast()
    ok = js("return (async () => (await Konys.datos.listarHorarios()).some(h => h.duracion_slot === 30))()")
    assert ok, "el cambio no se guardó"
    return "lunes almuerzo → 30 min"


@caso("ADM-19", "Admin", "Agregar jornada y rechazar jornadas inválidas", "RF-11")
def adm_horario_agregar():
    esperar_toast_oculto()
    Select(uno("#h-dia")).select_by_value("lunes")
    clic("#form-horario button[type=submit]")
    dup = toast()
    assert "ya tiene" in dup, f"acepta una jornada repetida: {dup}"
    esperar_toast_oculto()
    Select(uno("#h-dia")).select_by_value("domingo")
    poner_valor("#h-inicio", "14:00")
    poner_valor("#h-fin", "12:00")
    clic("#form-horario button[type=submit]")
    inv = toast()
    assert "posterior" in inv, f"acepta fin antes del inicio: {inv}"
    esperar_toast_oculto()
    poner_valor("#h-inicio", "12:00")
    poner_valor("#h-fin", "14:00")
    clic("#form-horario button[type=submit]")
    toast()
    esperar_que(lambda: contar("#tabla-horarios tbody tr") == 14, mensaje="no se agregó el almuerzo del domingo")
    captura("Admin — horarios", "admin-horarios")
    return "duplicada y hora invertida rechazadas; domingo almuerzo agregado"


@caso("ADM-20", "Admin", "Borrar una jornada", "RF-11")
def adm_horario_borrar():
    f = [x for x in todos("#tabla-horarios tbody tr") if "Domingo" in x.text and "Almuerzo" in x.text][0]
    clic(f.find_element(By.CSS_SELECTOR, '[data-accion="borrar-horario"]'))
    d().switch_to.alert.accept()
    esperar_que(lambda: contar("#tabla-horarios tbody tr") == 13, mensaje="no se borró la jornada")
    return "vuelve a 13 jornadas"


@caso("ADM-21", "Admin", "Carta: ocultar un plato", "RF-14")
def adm_plato_ocultar():
    clic('[data-seccion="carta"]')
    esperar("#tabla-platos table")
    clic(fila("#tabla-platos", "Pan de ajo").find_element(By.CSS_SELECTOR, ".toggle"))
    esperar_que(lambda: "Oculto" in fila("#tabla-platos", "Pan de ajo").text, mensaje="el plato no queda oculto")
    return toast()


@caso("ADM-22", "Admin", "Nuevo plato: validación, creación y edición", "RF-14")
def adm_plato_nuevo():
    clic("#btn-nuevo-plato")
    esperar("#modal-plato:not([hidden])")
    clic("#form-plato button[type=submit]")
    assert visible("#e-p-nombre") and visible("#e-p-precio"), "no valida nombre y precio"
    escribir("#p-nombre", "Pizza de Prueba")
    Select(uno("#p-categoria")).select_by_value("pizzas")
    escribir("#p-descripcion", "Creada por Selenium")
    escribir("#p-precio", "30000")
    clic("#form-plato button[type=submit]")
    toast()
    esperar_que(lambda: "Pizza de Prueba" in texto("#tabla-platos"), mensaje="el plato nuevo no aparece")
    clic(fila("#tabla-platos", "Pizza de Prueba").find_element(By.CSS_SELECTOR, '[data-accion="editar-plato"]'))
    esperar("#modal-plato:not([hidden])")
    escribir("#p-precio", "32500")
    clic("#form-plato button[type=submit]")
    esperar_que(lambda: "$32.500" in fila("#tabla-platos", "Pizza de Prueba").text, mensaje="no se guarda el nuevo precio")
    captura("Admin — carta", "admin-carta")
    return "creado a $30.000 y editado a $32.500"


@caso("ADM-23", "Admin", "Borrar un plato (con confirmación)", "RF-14")
def adm_plato_borrar():
    antes = contar("#tabla-platos tbody tr")
    clic(fila("#tabla-platos", "Coca-Cola").find_element(By.CSS_SELECTOR, '[data-accion="borrar-plato"]'))
    d().switch_to.alert.accept()
    esperar_que(lambda: contar("#tabla-platos tbody tr") == antes - 1, mensaje="no se borró el plato")
    return f"{antes} → {antes - 1} platos"


@caso("ADM-24", "Admin", "Filtro de platos por categoría", "RF-14")
def adm_plato_filtro():
    clic('#filtro-platos [data-categoria="entradas"]')
    cats = {f.find_elements(By.TAG_NAME, "td")[1].text for f in todos("#tabla-platos tbody tr")}
    clic('#filtro-platos [data-categoria=""]')
    assert cats == {"Entradas"}, f"categorías con el filtro Entradas: {cats}"
    return "solo entradas"


@caso("ADM-25", "Admin", "Navegación directa por URL (#horarios)", "RNF-01")
def adm_hash():
    ir("/admin#horarios")
    esperar("#tabla-horarios table")
    assert visible("#sec-horarios") and not visible("#sec-reservas"), "no abre la sección de la URL"
    return "abre la sección indicada"


# =============================================================================
# 5. INTEGRACIÓN: lo que hace el admin se ve en el sitio del cliente
# =============================================================================
@caso("INT-01", "Integración", "Mesa desactivada desaparece del sitio", "RF-13")
def int_mesa():
    d().switch_to.new_window("tab")
    ir("/")
    esperar(".mesa")
    nombres = [h.text for h in todos(".mesa h3")]
    assert "Mesa 2" not in nombres, "la Mesa 2 (inactiva) sigue apareciendo"
    assert "Mesa 10" not in nombres, "aparece la Mesa 10, que se borró"
    return f"{len(nombres)} mesas visibles"


@caso("INT-02", "Integración", "Cambios de la carta se reflejan en el sitio", "RF-14")
def int_carta():
    carta = texto("#carta-contenido")
    assert "Pan de ajo" not in carta, "el plato oculto sigue en la carta"
    assert "Pizza de Prueba" in carta and "$32.500" in carta, "el plato nuevo no aparece con su precio"
    assert "Coca-Cola" not in carta, "el plato borrado sigue en la carta"
    return "oculto, nuevo y borrado ok"


@caso("INT-03", "Integración", "El nuevo horario (30 min) cambia los turnos del lunes", "RF-11")
def int_horario():
    lunes = js("""const x = new Date(); do { x.setDate(x.getDate()+1); } while (x.getDay() !== 1);
      return Konys.util.fechaISO(x);""")
    abrir_mesa("Mesa 1")
    abrir_fecha(lunes)
    slots = [b.get_attribute("data-slot") for b in todos("#slots .slot")]
    clic("#modal-cerrar")
    assert "12:00" in slots and "12:30" in slots, f"turnos del almuerzo del lunes: {slots}"
    return f"lunes {lunes}: {', '.join(s for s in slots if s < '15:00')}"


@caso("ADM-26", "Responsive", "Panel admin en móvil sin scroll horizontal", "RNF-02")
def adm_movil():
    d().close()
    d().switch_to.window(d().window_handles[0])
    tamano(390, 844, movil=True)
    ir("/admin#reservas")
    esperar("#tabla-reservas table")
    ancho = js("return document.documentElement.scrollWidth")
    captura("Admin — móvil", "admin-movil", completa=False)
    tamano(1440, 900)
    assert ancho <= 390, f"scrollWidth={ancho}px"
    return f"scrollWidth={ancho}px (la tabla se desplaza dentro de su caja)"


@caso("ADM-27", "Admin", "Cerrar sesión vuelve a la pantalla de acceso", "RF-08")
def adm_salir():
    ir("/admin")
    esperar("#panel")
    clic(".lateral__pie [data-salir]")
    assert visible("#acceso") and not visible("#panel"), "no vuelve al acceso"
    d().refresh()
    time.sleep(0.4)
    assert not visible("#panel"), "tras salir y recargar sigue dentro"
    return "sesión cerrada"


def entrar(clave=CLAVE_ADMIN):
    ir("/admin")
    esperar("#clave")
    escribir("#clave", clave)
    clic("#btn-ingresar")


@caso("SEG-05", "Seguridad", "Al cerrar sesión no quedan datos en la página y el token deja de servir", "RNF-05")
def seg_cerrar_sesion():
    entrar()
    esperar("#tabla-reservas table")
    viejo = js("return sessionStorage.getItem('konys_admin_sesion')")
    clic(".lateral__pie [data-salir]")
    html_pagina = js("return document.body.innerHTML")
    restos = [x for x in ["Juan Pérez", "300 000 0001", "Prueba Selenium", "María José"] if x in html_pagina]
    assert not restos, f"después de salir siguen en el HTML: {restos}"
    assert js("return sessionStorage.getItem('konys_admin_sesion')") is None, "el token sigue guardado"
    # Alguien que copió el token antes de salir intenta reutilizarlo
    js("const v = JSON.parse(arguments[0]); v.expira = Date.now() + 3600e3; sessionStorage.setItem('konys_admin_sesion', JSON.stringify(v));", viejo)
    d().refresh()
    time.sleep(0.6)
    assert not visible("#panel"), "un token de una sesión cerrada volvió a abrir el panel"
    return "sin nombres ni teléfonos en el HTML; el token copiado ya no funciona"


@caso("SEG-06", "Seguridad", "La sesión se cierra sola al vencer y avisa un minuto antes", "RNF-05")
def seg_vencimiento():
    entrar()
    esperar("#tabla-reservas table")
    # Se adelanta el reloj de la sesión: quedan 59 segundos
    js("const v = JSON.parse(sessionStorage.getItem('konys_admin_sesion')); v.expira = Date.now() + 59e3; sessionStorage.setItem('konys_admin_sesion', JSON.stringify(v));")
    aviso = esperar_que(lambda: visible("#toast") and "1 minuto" in texto("#toast") and texto("#toast"), 4, "no avisó que faltaba 1 minuto")
    # Ahora vence
    js("const v = JSON.parse(sessionStorage.getItem('konys_admin_sesion')); v.expira = Date.now() + 1500; sessionStorage.setItem('konys_admin_sesion', JSON.stringify(v));")
    esperar_que(lambda: visible("#acceso") and not visible("#panel"), 5, "el panel siguió abierto después de vencer")
    msg = texto("#e-clave")
    assert "expiró" in msg, f"no explica que la sesión expiró: «{msg}»"
    captura("Seguridad — sesión vencida", "sesion-vencida", completa=False)
    return f"aviso «{aviso}»; al vencer: «{msg}»"


@caso("SEG-07", "Seguridad", "Cambiar la hora de vencimiento en el navegador no alarga la sesión", "RNF-05")
def seg_manipular_reloj():
    entrar()
    esperar("#tabla-reservas table")
    # El "servidor" (la base de datos) vence la sesión; el atacante pone 1 hora más en el navegador
    js("""const v = JSON.parse(sessionStorage.getItem('konys_admin_sesion'));
      const s = JSON.parse(localStorage.getItem('konys_demo_sesiones')).map(x => x.token === v.token ? Object.assign(x, {expira: Date.now() - 1000}) : x);
      localStorage.setItem('konys_demo_sesiones', JSON.stringify(s));
      v.expira = Date.now() + 3600e3; sessionStorage.setItem('konys_admin_sesion', JSON.stringify(v));""")
    r = js("return (async () => { try { await Konys.datos.listarReservas(); return 'ACEPTADA'; } catch (e) { return e.codigo; } })()")
    assert r == "NO_AUTORIZADO", f"con la sesión vencida se pudieron leer las reservas: {r}"
    clic('[data-seccion="reservas"]')
    esperar_que(lambda: visible("#acceso") and not visible("#panel"), 5, "con la hora alterada el panel siguió abierto")
    return "la base de datos rechaza el token vencido aunque el navegador diga lo contrario"


@caso("SEG-08", "Seguridad", "Fuerza bruta: 5 contraseñas incorrectas bloquean el acceso 10 minutos", "RNF-05")
def seg_fuerza_bruta():
    js("localStorage.removeItem('konys_demo_intentos'); sessionStorage.clear();")
    ir("/admin")
    esperar("#clave")
    for i in range(5):
        escribir("#clave", f"incorrecta{i}")
        clic("#btn-ingresar")
        esperar_que(lambda: visible("#e-clave"), mensaje="no respondió al intento fallido")
        time.sleep(0.2)
    escribir("#clave", CLAVE_ADMIN)
    clic("#btn-ingresar")
    msg = esperar_que(lambda: "intentos" in texto("#e-clave") and texto("#e-clave"), mensaje="no se bloqueó después de 5 fallos")
    assert not visible("#panel"), "entró al panel estando bloqueado"
    captura("Seguridad — acceso bloqueado por intentos fallidos", "bloqueo-fuerza-bruta", completa=False)
    js("localStorage.removeItem('konys_demo_intentos')")
    return f"al sexto intento, incluso con la clave correcta: «{msg}»"


@caso("GEN-01", "General", "Sin errores de JavaScript en consola", "RNF")
def gen_consola():
    recoger_consola()
    assert not ERRORES_CONSOLA, f"{len(ERRORES_CONSOLA)} errores: " + " | ".join(e["mensaje"][:120] for e in ERRORES_CONSOLA[:3])
    return "consola limpia en todas las páginas"


ORDEN = [cli_carga, cli_menu, cli_mesas, cli_filtro_zona, cli_carta, cli_filtro_carta, cli_imagenes,
         cli_abrir_reserva, cli_calendario, cli_slots_ocupados, cli_slots_hoy, cli_valida_nombre,
         cli_valida_capacidad, cli_doble_reserva, cli_reserva_ok, cli_slot_reservado, cli_cerrar_modal, cli_xss,
         val_personas_teclado, val_personas_envio, val_nombre, val_telefono, val_blur, val_reserva_valida, val_api_reserva,
         res_movil, res_menu, res_modal, res_tablet, res_tactil,
         cal_a11y_inicio, cal_a11y_admin, cal_seo, cal_enlaces_internos, cal_enlaces_externos, cal_rendimiento,
         adm_sin_sesion, adm_clave_vacia, adm_clave_mala, adm_login, adm_recarga,
         seg_codigo_fuente, seg_almacenamiento, seg_duracion, seg_encabezados, seg_archivos_internos, adm_reservas, adm_xss,
         adm_filtros, adm_estado_reserva, adm_mesas, adm_mesa_validacion, adm_mesa_nueva, adm_mesa_editar,
         adm_mesa_desactivar, adm_mesa_filtro, adm_mesa_borrar, val_admin_mesa, val_admin_plato, val_admin_horario, val_api_admin,
         adm_horarios, adm_horario_editar,
         adm_horario_agregar, adm_horario_borrar, adm_plato_ocultar, adm_plato_nuevo, adm_plato_borrar,
         adm_plato_filtro, adm_hash, int_mesa, int_carta, int_horario, adm_movil, adm_salir,
         seg_cerrar_sesion, seg_vencimiento, seg_manipular_reloj, seg_fuerza_bruta, gen_consola]


# =============================================================================
# Informe HTML
# =============================================================================
def generar_informe(salida, inicio, fin, info):
    e = html.escape
    tot = len(CASOS)
    cuenta = {k: sum(1 for c in CASOS if c["estado"] == k) for k in ("ok", "aviso", "fallo", "error")}
    aprob = cuenta["ok"] + cuenta["aviso"]
    pct = round(100 * aprob / tot) if tot else 0
    modulos = []
    for c in CASOS:
        if c["modulo"] not in modulos:
            modulos.append(c["modulo"])
    etiqueta = {"ok": "Aprobado", "aviso": "Aviso", "fallo": "Falló", "error": "Error"}

    filas_mod = "".join(
        f"<tr><td>{e(m)}</td><td class=n>{sum(1 for c in CASOS if c['modulo'] == m)}</td>"
        f"<td class=n>{sum(1 for c in CASOS if c['modulo'] == m and c['estado'] == 'ok')}</td>"
        f"<td class=n>{sum(1 for c in CASOS if c['modulo'] == m and c['estado'] == 'aviso')}</td>"
        f"<td class=n>{sum(1 for c in CASOS if c['modulo'] == m and c['estado'] in ('fallo', 'error'))}</td></tr>"
        for m in modulos)

    def tabla_casos(m):
        filas = []
        for c in [x for x in CASOS if x["modulo"] == m]:
            cap = ""
            if c["captura"] is not None:
                cap = f' <a href="#cap-{c["captura"]}">ver captura</a>'
            filas.append(f"<tr class={c['estado']}><td class=cod>{e(c['codigo'])}</td><td>{e(c['nombre'])}"
                         f"<div class=det>{e(c['detalle'])}{cap}</div></td><td>{e(c['requisito'])}</td>"
                         f"<td><span class='pill {c['estado']}'>{etiqueta[c['estado']]}</span></td>"
                         f"<td class=n>{c['duracion']:.2f} s</td></tr>")
        return ("<table><thead><tr><th>Código</th><th>Caso de prueba</th><th>Requisito</th><th>Resultado</th>"
                "<th class=n>Tiempo</th></tr></thead><tbody>" + "".join(filas) + "</tbody></table>")

    secciones = "".join(f"<h3>{e(m)}</h3>{tabla_casos(m)}" for m in modulos)

    problemas = [c for c in CASOS if c["estado"] != "ok"]
    if problemas:
        lista_prob = "".join(
            f"<li class={c['estado']}><strong>{e(c['codigo'])} · {e(c['nombre'])}</strong> "
            f"<span class='pill {c['estado']}'>{etiqueta[c['estado']]}</span><br>{e(c['detalle'])}</li>"
            for c in problemas)
    else:
        lista_prob = "<li class=ok>No se encontraron fallos ni advertencias.</li>"
    extra = "".join(f"<li class=aviso><strong>{e(a)} · {e(b)}</strong><br>{e(c)}</li>" for a, b, c in HALLAZGOS)

    filas_met = "".join(
        f"<tr><td>{e(n)}</td><td class=n>{m['ttfb']:.0f} ms</td><td class=n>{m['dcl']:.0f} ms</td>"
        f"<td class=n>{m.get('promedio', m['carga']):.0f} ms</td><td class=n>{m['recursos']}</td>"
        f"<td class=n>{m['peso'] / 1024:.0f} KB</td></tr>" for n, m in METRICAS.items())

    rev = ctx.get("revisiones", {})
    filas_a11y = ""
    for n, r in rev.items():
        filas_a11y += (f"<tr><td>{e(n)}</td><td>{e(r['lang'])}</td><td class=n>{r['h1']}</td>"
                       f"<td class=n>{len(r['imgSinAlt'])}</td><td class=n>{len(r['camposSinEtiqueta'])}</td>"
                       f"<td class=n>{len(r['botonesSinNombre'])}</td><td class=n>{len(set(r['idsRepetidos']))}</td>"
                       f"<td class=n>{len(r['enlaces'])}</td></tr>")
    externos = "".join(f"<li><a href='{e(u)}'>{e(t or u)}</a> <span class=gris>{e(u)}</span></li>"
                       for u, t in ctx.get("externos", {}).items())
    consola = ("".join(f"<li><code>{e(x['mensaje'][:300])}</code> <span class=gris>{e(x['pagina'])}</span></li>"
                       for x in ERRORES_CONSOLA) or "<li>Sin errores.</li>")
    capturas = "".join(
        f"<figure id='cap-{i}'><img src='data:image/jpeg;base64,{b64}' alt='{e(t)}' loading=lazy>"
        f"<figcaption>{i + 1}. {e(t)} <span class=gris>capturas/{e(f)}</span></figcaption></figure>"
        for i, (t, f, b64) in enumerate(CAPTURAS))

    if cuenta["fallo"] + cuenta["error"] == 0:
        conclusion = (f"Los {tot} casos de prueba se ejecutaron sobre las dos páginas del sitio (cliente y panel de "
                      f"administración) y ninguno falló. "
                      + (f"Hay {cuenta['aviso']} advertencia(s) de calidad que no bloquean el uso, pero conviene revisarlas. "
                         if cuenta["aviso"] else "")
                      + "El flujo completo de reserva, la gestión del administrador y su efecto en el sitio público "
                        "funcionan como piden los requisitos.")
    else:
        conclusion = (f"De {tot} casos, {cuenta['fallo'] + cuenta['error']} no pasaron. Los detalles y las capturas "
                      f"de cada fallo están en la sección «Hallazgos». Se recomienda corregirlos y volver a ejecutar "
                      f"la suite antes de publicar.")

    estado_global = "ok" if cuenta["fallo"] + cuenta["error"] == 0 else "fallo"
    pagina = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe de pruebas Selenium · Konys Pizza</title>
<style>
:root {{ --azul:#0F2B3D; --naranja:#F28C28; --ok:#1e7d4f; --okf:#e6f4ec; --av:#9a6200; --avf:#fff4dc;
  --mal:#b3261e; --malf:#fde8e6; --linea:#e3e7ea; --gris:#5f6b74; --fondo:#f6f7f8; }}
* {{ box-sizing:border-box }}
body {{ margin:0; font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:#1b262d; background:var(--fondo) }}
header {{ background:var(--azul); color:#fff; padding:40px 24px 32px }}
header .c, main {{ max-width:1100px; margin:0 auto }}
header p {{ margin:4px 0; color:#c8d4dc }}
h1 {{ margin:0 0 6px; font-size:30px }} h2 {{ margin:44px 0 12px; font-size:22px; color:var(--azul);
  border-bottom:3px solid var(--naranja); padding-bottom:6px }} h3 {{ margin:28px 0 8px; font-size:17px }}
main {{ padding:8px 24px 64px }}
.tarjetas {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-top:24px }}
.t {{ background:#fff; border:1px solid var(--linea); border-radius:10px; padding:16px }}
.t b {{ display:block; font-size:30px; line-height:1.1 }} .t span {{ color:var(--gris); font-size:13px }}
.t.ok b {{ color:var(--ok) }} .t.aviso b {{ color:var(--av) }} .t.fallo b {{ color:var(--mal) }}
.barra {{ height:10px; border-radius:6px; background:var(--malf); overflow:hidden; margin-top:16px }}
.barra i {{ display:block; height:100%; background:var(--ok); width:{pct}% }}
table {{ width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--linea); border-radius:10px; overflow:hidden; font-size:14px }}
th, td {{ text-align:left; padding:9px 12px; border-bottom:1px solid var(--linea); vertical-align:top }}
th {{ background:#eef1f3; font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--gris) }}
td.n, th.n {{ text-align:right; white-space:nowrap }} td.cod {{ font-family:ui-monospace,Consolas,monospace; white-space:nowrap }}
tr.fallo td, tr.error td {{ background:var(--malf) }} tr.aviso td {{ background:var(--avf) }}
.det {{ color:var(--gris); font-size:13px; margin-top:2px; word-break:break-word }}
.pill {{ display:inline-block; padding:2px 9px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap }}
.pill.ok {{ background:var(--okf); color:var(--ok) }} .pill.aviso {{ background:var(--avf); color:var(--av) }}
.pill.fallo, .pill.error {{ background:var(--malf); color:var(--mal) }}
ul.h {{ list-style:none; padding:0; margin:0; display:grid; gap:8px }}
ul.h li {{ background:#fff; border:1px solid var(--linea); border-left:4px solid var(--ok); border-radius:8px; padding:10px 14px }}
ul.h li.aviso {{ border-left-color:var(--av) }} ul.h li.fallo, ul.h li.error {{ border-left-color:var(--mal) }}
.gris {{ color:var(--gris); font-size:12px }}
dl.env {{ display:grid; grid-template-columns:max-content 1fr; gap:4px 18px; background:#fff; border:1px solid var(--linea); border-radius:10px; padding:16px; margin:0 }}
dl.env dt {{ color:var(--gris) }} dl.env dd {{ margin:0 }}
.galeria {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px }}
figure {{ margin:0; background:#fff; border:1px solid var(--linea); border-radius:10px; overflow:hidden }}
figure img {{ width:100%; max-height:420px; object-fit:cover; object-position:top; display:block; border-bottom:1px solid var(--linea); cursor:zoom-in }}
figure img.grande {{ max-height:none; object-fit:contain }}
figcaption {{ padding:8px 12px; font-size:13px }}
.concl {{ background:#fff; border:1px solid var(--linea); border-left:4px solid var(--{'ok' if estado_global == 'ok' else 'mal'}); border-radius:8px; padding:14px 18px }}
.scroll {{ overflow-x:auto }}
@media print {{ header {{ -webkit-print-color-adjust:exact; print-color-adjust:exact }} figure {{ break-inside:avoid }} tr {{ break-inside:avoid }} }}
@media (max-width:600px) {{ th:nth-child(3), td:nth-child(3), th:nth-child(5), td:nth-child(5) {{ display:none }} }}
</style></head><body>
<header><div class=c>
<p>Informe de pruebas automatizadas</p>
<h1>Konys Pizza · Reservas de mesas</h1>
<p>Selenium WebDriver {e(info['selenium'])} · {e(info['navegador'])} · {inicio:%d/%m/%Y %H:%M}</p>
</div></header>
<main>
<div class=tarjetas>
<div class=t><b>{tot}</b><span>casos ejecutados</span></div>
<div class="t ok"><b>{cuenta['ok']}</b><span>aprobados</span></div>
<div class="t aviso"><b>{cuenta['aviso']}</b><span>con aviso</span></div>
<div class="t fallo"><b>{cuenta['fallo'] + cuenta['error']}</b><span>fallidos</span></div>
<div class=t><b>{pct}%</b><span>tasa de éxito</span></div>
<div class=t><b>{(fin - inicio).total_seconds():.0f} s</b><span>duración total</span></div>
</div>
<div class=barra><i></i></div>

<h2>1. Conclusión</h2>
<div class=concl>{e(conclusion)}</div>

<h2>2. Alcance y entorno</h2>
<p>Se probaron las dos páginas de la aplicación como lo haría un usuario real, con un navegador Chrome manejado por Selenium:
el <strong>sitio del cliente</strong> (<code>index.html</code>: mesas, carta, calendario, horarios y reserva) y el
<strong>panel de administración</strong> (<code>admin.html</code>: acceso, reservas, mesas, horarios y carta). En el módulo
<strong>Validación</strong> se intentó romper cada campo como lo haría un usuario malintencionado: letras en números, decimales,
notación científica (1e1), correos en el teléfono, HTML en los nombres, valores fuera de rango y datos alterados desde la consola
del navegador. También se revisó
cómo se ve en móvil y tablet, la accesibilidad básica, el SEO, los enlaces, el rendimiento y que no haya inyección de HTML.
Todo corre en <strong>modo demostración</strong> (datos en el navegador), así que la base de datos real de Supabase no se toca.</p>
<dl class=env>
<dt>URL probada</dt><dd>{e(URL)} (servidor local que imita a Vercel)</dd>
<dt>Navegador</dt><dd>{e(info['navegador'])} {'(sin ventana)' if info['headless'] else '(con ventana)'}</dd>
<dt>Herramienta</dt><dd>Selenium WebDriver {e(info['selenium'])} · Python {e(platform.python_version())}</dd>
<dt>Sistema</dt><dd>{e(platform.system())} {e(platform.release())}</dd>
<dt>Resoluciones</dt><dd>Escritorio 1440×900 · Tablet 768×1024 · Móvil 390×844</dd>
<dt>Inicio / fin</dt><dd>{inicio:%d/%m/%Y %H:%M:%S} – {fin:%H:%M:%S}</dd>
<dt>Rama</dt><dd>{e(info['rama'])}</dd>
</dl>

<h2>3. Resumen por módulo</h2>
<div class=scroll><table><thead><tr><th>Módulo</th><th class=n>Casos</th><th class=n>Aprobados</th><th class=n>Avisos</th><th class=n>Fallidos</th></tr></thead>
<tbody>{filas_mod}</tbody></table></div>

<h2>4. Hallazgos</h2>
<ul class=h>{lista_prob}{extra}</ul>

<h2>5. Detalle de los casos de prueba</h2>
<div class=scroll>{secciones}</div>

<h2>6. Rendimiento</h2>
<p class=gris>Medido con la API Navigation Timing del navegador en el servidor local. En producción (Vercel + Supabase) los tiempos serán algo mayores por la red.</p>
<div class=scroll><table><thead><tr><th>Página</th><th class=n>Primer byte</th><th class=n>DOM listo</th><th class=n>Carga completa</th><th class=n>Recursos</th><th class=n>Peso</th></tr></thead>
<tbody>{filas_met}</tbody></table></div>

<h2>7. Accesibilidad y SEO</h2>
<div class=scroll><table><thead><tr><th>Página</th><th>Idioma</th><th class=n>h1</th><th class=n>Imágenes sin alt</th><th class=n>Campos sin etiqueta</th><th class=n>Botones sin nombre</th><th class=n>IDs repetidos</th><th class=n>Enlaces</th></tr></thead>
<tbody>{filas_a11y}</tbody></table></div>
<h3>Enlaces externos encontrados</h3>
<ul>{externos}</ul>
<h3>Errores de consola de JavaScript</h3>
<ul>{consola}</ul>

<h2>8. Capturas de pantalla</h2>
<p class=gris>Haz clic en una captura para verla completa. Los archivos también están en la carpeta <code>capturas/</code>.</p>
<div class=galeria>{capturas}</div>
</main>
<script>document.querySelectorAll('figure img').forEach(i => i.addEventListener('click', () => i.classList.toggle('grande')));</script>
</body></html>"""
    (salida / "informe.html").write_text(pagina, encoding="utf-8")
    datos = {"inicio": inicio.isoformat(), "fin": fin.isoformat(), "entorno": info, "resumen": cuenta,
             "casos": [{k: v for k, v in c.items() if k != "traza"} for c in CASOS], "metricas": METRICAS,
             "errores_consola": ERRORES_CONSOLA}
    (salida / "resultados.json").write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")


# =============================================================================
# Principal
# =============================================================================
def main():
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass
    ap = argparse.ArgumentParser(description="Pruebas Selenium de Konys Pizza")
    ap.add_argument("--ver", action="store_true", help="mostrar la ventana del navegador")
    ap.add_argument("--externos", action="store_true", help="abrir también los enlaces externos")
    ap.add_argument("--salida", default=str(RAIZ / "informe-selenium"), help="carpeta del informe")
    args = ap.parse_args()
    ctx["args"] = args
    salida = Path(args.salida).resolve()
    (salida / "capturas").mkdir(parents=True, exist_ok=True)
    for viejo in (salida / "capturas").glob("*.jpg"):
        viejo.unlink()
    ctx["salida"] = salida

    servidor = ServidorHilos(("localhost", PUERTO), Servidor)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()

    op = webdriver.ChromeOptions()
    if not args.ver:
        op.add_argument("--headless=new")
    op.add_argument("--window-size=1440,900")
    op.add_argument("--lang=es-CO")
    op.add_argument("--disable-search-engine-choice-screen")
    op.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    print("Iniciando Chrome…")
    driver = webdriver.Chrome(options=op)
    ctx["driver"] = driver
    import selenium
    try:
        rama = os.popen(f'git -C "{RAIZ}" rev-parse --abbrev-ref HEAD').read().strip() or "—"
    except Exception:  # noqa: BLE001
        rama = "—"
    info = {"navegador": f"Chrome {driver.capabilities.get('browserVersion', '?')}", "selenium": selenium.__version__,
            "headless": not args.ver, "rama": rama}
    print(f"{info['navegador']} · Selenium {info['selenium']} · {URL}\n")

    inicio = dt.datetime.now()
    try:
        for fn in ORDEN:
            fn()
    finally:
        fin = dt.datetime.now()
        try:
            generar_informe(salida, inicio, fin, info)
        finally:
            driver.quit()
            servidor.shutdown()

    malos = sum(1 for c in CASOS if c["estado"] in ("fallo", "error"))
    avisos = sum(1 for c in CASOS if c["estado"] == "aviso")
    print(f"\n{len(CASOS)} casos · {len(CASOS) - malos - avisos} aprobados · {avisos} avisos · {malos} fallidos")
    print(f"Informe: {salida / 'informe.html'}")
    sys.exit(1 if malos else 0)


if __name__ == "__main__":
    main()
