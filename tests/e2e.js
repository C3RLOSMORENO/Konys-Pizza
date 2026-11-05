// Prueba de punta a punta del cliente y del panel admin (modo demostración).
// Uso:  npm test                               → solo verifica
//       node tests/e2e.js . capturas           → además guarda capturas
// Para usar el Chrome instalado en vez del de Playwright: CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const PUERTO = 5173;
const URL = 'http://localhost:' + PUERTO;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

// Servidor estático mínimo (igual que Vercel con cleanUrls: /admin → admin.html)
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/admin') p = '/admin.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const resultados = [];
function check(nombre, ok, detalle) { resultados.push((ok ? '✅ ' : '❌ ') + nombre + (detalle ? ' — ' + detalle : '')); }
const captura = (pg, nombre, completa) => (OUT ? pg.screenshot({ path: path.join(OUT, nombre), fullPage: !!completa }) : null);

async function abrirFecha(pg, fecha) {
  if (!(await pg.locator('[data-fecha="' + fecha + '"]').count())) await pg.click('[data-mes="1"]');
  await pg.click('[data-fecha="' + fecha + '"]');
  await pg.waitForSelector('#slots .slot');
}

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => servidor.listen(PUERTO, r));
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const errores = [];
  const vigilar = (p) => {
    p.on('pageerror', e => errores.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errores.push('console: ' + m.text()); });
    return p;
  };
  const nuevaPagina = async (w, h) => vigilar(await (await browser.newContext({ viewport: { width: w, height: h } })).newPage());

  // ---------- Cliente escritorio ----------
  const p = await nuevaPagina(1440, 900);
  await p.goto(URL + '/');
  await p.waitForSelector('.mesa');
  check('RF-01 muestra mesas activas', (await p.locator('.mesa').count()) === 8, (await p.locator('.mesa').count()) + ' tarjetas');
  check('RF-07 carta oculta platos no disponibles', (await p.locator('text=Konys Vegetariana').count()) === 0);
  await p.click('#filtro-zona [data-zona="terraza"]');
  check('Filtro por zona', (await p.locator('.mesa').count()) === 4);
  await p.click('#filtro-zona [data-zona=""]');
  await captura(p, '01-inicio-escritorio.png', true);

  await p.click('.mesa:has-text("Mesa 3") [data-mesa]');
  await p.waitForSelector('#modal-reserva:not([hidden])');
  check('RF-02 abre el flujo de reserva', await p.isVisible('#calendario'));
  const manana = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return Konys.util.fechaISO(d); });
  await abrirFecha(p, manana);
  check('RF-04 horario reservado aparece ocupado', await p.locator('#slots .slot[data-slot="19:30"]').isDisabled());
  check('RF-03 días pasados deshabilitados', await p.evaluate(() => {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const b = document.querySelector('[data-fecha="' + Konys.util.fechaISO(ayer) + '"]');
    return !b || b.disabled;
  }));
  await p.click('#slots .slot[data-slot="20:30"]');
  await p.fill('#r-nombre', 'Prueba Automática');
  await p.fill('#r-personas', '9');
  await p.click('#btn-confirmar');
  check('CU-02 alterno: capacidad superada muestra error', await p.isVisible('#e-personas'), await p.textContent('#e-personas'));
  await p.fill('#r-personas', '4');
  check('El error se quita al corregir el campo', await p.isHidden('#e-personas'));
  await captura(p, '02-reserva-escritorio.png');

  // Condición de carrera: otra persona reserva el mismo horario justo antes de confirmar
  await p.evaluate(async (f) => {
    const m = (await Konys.datos.listarMesas()).find(x => x.nombre === 'Mesa 3');
    await Konys.datos.crearReserva({ mesa_id: m.id, cliente_nombre: 'Otra persona', cliente_contacto: null, num_personas: 2, fecha: f, hora_inicio: '20:30', hora_fin: '21:30' });
  }, manana);
  await p.click('#btn-confirmar');
  await p.waitForSelector('#alerta-slot .alerta--error');
  check('§12.2 doble reserva detectada antes de guardar', true, await p.textContent('#alerta-slot strong'));
  check('El horario tomado pasa a ocupado', await p.locator('#slots .slot[data-slot="20:30"]').isDisabled());
  await captura(p, '03-reserva-error.png');

  await p.click('#slots .slot[data-slot="21:30"]');
  await p.click('#btn-confirmar');
  await p.waitForSelector('#vista-confirmacion:not([hidden])');
  check('RF-05/RF-06 reserva guardada y comprobante visible', (await p.textContent('#detalle-reserva')).indexOf('Prueba Automática') >= 0);
  await captura(p, '04-confirmacion.png');

  await p.click('#btn-volver');
  await p.click('.mesa:has-text("Mesa 3") [data-mesa]');
  await abrirFecha(p, manana);
  check('Horario recién reservado aparece ocupado', await p.locator('#slots .slot[data-slot="21:30"]').isDisabled());
  await p.keyboard.press('Escape');
  check('Esc cierra el modal', await p.isHidden('#modal-reserva'));

  // ---------- Cliente móvil ----------
  const m = await nuevaPagina(390, 844);
  await m.goto(URL + '/');
  await m.waitForSelector('.mesa');
  const anchoDoc = await m.evaluate(() => document.documentElement.scrollWidth);
  check('RNF-02 sin scroll horizontal en móvil', anchoDoc <= 390, 'scrollWidth=' + anchoDoc);
  await captura(m, '05-inicio-movil.png', true);
  await m.click('#nav-toggle');
  check('Menú móvil se abre', await m.isVisible('#nav a[href="#carta"]'));
  await m.click('#nav a[href="#mesas"]');
  await m.click('.mesa:has-text("Mesa 1") [data-mesa]');
  await abrirFecha(m, manana);
  await captura(m, '06-reserva-movil.png');
  const anchoModal = await m.evaluate(() => document.querySelector('.modal__cuerpo').scrollWidth);
  check('Modal sin desbordes en móvil', anchoModal <= 390, 'scrollWidth=' + anchoModal);

  // ---------- Administrador ----------
  const a = await nuevaPagina(1440, 900);
  await a.goto(URL + '/admin');
  await a.fill('#clave', 'incorrecta');
  await a.click('#btn-ingresar');
  await a.waitForSelector('#e-clave:not([hidden])');
  check('RF-08 contraseña incorrecta rechazada', await a.isHidden('#panel'));
  await captura(a, '07-admin-acceso-error.png');
  await a.fill('#clave', 'konys2026');
  await a.click('#btn-ingresar');
  await a.waitForSelector('#tabla-reservas table');
  const filas = await a.locator('#tabla-reservas tbody tr').count();
  check('RF-12 lista reservas', filas >= 10, filas + ' filas');
  await a.fill('#f-fecha', manana);
  await a.click('#form-filtros button[type=submit]');
  await a.waitForTimeout(400);
  const filasF = await a.locator('#tabla-reservas tbody tr').count();
  check('RF-12 filtro por fecha', filasF > 0 && filasF < filas, filasF + ' filas');
  await captura(a, '08-admin-reservas.png', true);

  await a.click('[data-seccion="mesas"]');
  await a.waitForSelector('#tabla-mesas table');
  check('RF-10 listado de mesas (incluye inactivas)', (await a.locator('#tabla-mesas tbody tr').count()) === 9);
  await a.click('#btn-nueva-mesa');
  await a.fill('#m-nombre', 'Mesa 10');
  await a.fill('#m-capacidad', '5');
  await a.click('#form-mesa button[type=submit]');
  await a.waitForTimeout(500);
  check('RF-09 registra mesa nueva', (await a.locator('#tabla-mesas tbody tr').count()) === 10);
  await a.locator('#tabla-mesas tr:has-text("Mesa 2") .toggle').click();
  await a.waitForTimeout(400);
  check('RF-13 desactiva mesa', (await a.locator('#tabla-mesas tr:has-text("Mesa 2") .badge').textContent()) === 'Inactiva');
  await captura(a, '09-admin-mesas.png', true);

  await a.click('[data-seccion="horarios"]');
  await a.waitForSelector('#tabla-horarios table');
  check('RF-11 muestra 13 jornadas (domingo sin almuerzo)', (await a.locator('#tabla-horarios tbody tr').count()) === 13);
  const dur = a.locator('#tabla-horarios tbody tr').first().locator('input[data-campo="duracion_slot"]');
  await dur.fill('30');
  await dur.dispatchEvent('change');
  await a.click('#btn-guardar-horarios');
  await a.waitForTimeout(500);
  check('RF-11 guarda cambios de horario', await a.evaluate(async () => (await Konys.datos.listarHorarios()).some(h => h.duracion_slot === 30)));
  await captura(a, '10-admin-horarios.png', true);

  await a.click('[data-seccion="carta"]');
  await a.waitForSelector('#tabla-platos table');
  await a.locator('#tabla-platos tr:has-text("Pan de ajo") .toggle').click();
  await a.waitForTimeout(400);
  await a.click('#btn-nuevo-plato');
  await a.fill('#p-nombre', 'Pizza de Prueba');
  await a.fill('#p-precio', '30000');
  await a.click('#form-plato button[type=submit]');
  await a.waitForTimeout(500);
  await captura(a, '11-admin-carta.png', true);

  // Los cambios del admin se ven en el sitio del cliente (mismo navegador = mismos datos de demostración)
  const c2 = vigilar(await a.context().newPage());
  await c2.goto(URL + '/');
  await c2.waitForSelector('.mesa');
  check('RF-13 mesa inactiva ya no aparece al cliente', (await c2.locator('.mesa:has-text("Mesa 2")').count()) === 0);
  check('RF-09 mesa nueva aparece al cliente', (await c2.locator('.mesa:has-text("Mesa 10")').count()) === 1);
  check('RF-14 plato oculto no aparece', (await c2.locator('text=Pan de ajo').count()) === 0);
  check('RF-14 plato nuevo aparece', (await c2.locator('text=Pizza de Prueba').count()) === 1);

  const am = await nuevaPagina(390, 844);
  await am.goto(URL + '/admin');
  await am.fill('#clave', 'konys2026');
  await am.click('#btn-ingresar');
  await am.waitForSelector('#tabla-reservas table');
  await captura(am, '12-admin-movil.png');
  const anchoAdm = await am.evaluate(() => document.documentElement.scrollWidth);
  check('Panel admin sin scroll horizontal de página en móvil', anchoAdm <= 390, 'scrollWidth=' + anchoAdm);

  check('Sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  console.log(resultados.join('\n'));
  await browser.close();
  servidor.close();
  if (resultados.some(r => r.startsWith('❌'))) process.exit(1);
})().catch(e => {
  console.error('FALLO:', e.message);
  console.log(resultados.join('\n'));
  process.exit(1);
});
