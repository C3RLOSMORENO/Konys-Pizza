// =============================================================================
// Konys Pizza · Capa de datos
// Conexión con Supabase mediante su API REST (fetch), §9.2.
// Si no hay credenciales en js/config.js, usa un "modo demostración" que guarda
// los datos en el navegador (localStorage) con la misma interfaz.
// =============================================================================
(function () {
  'use strict';

  const CONFIG = window.KONYS_CONFIG || {};
  // Se acepta la URL con o sin "https://" y con o sin "/rest/v1/" al final
  let URL_BASE = String(CONFIG.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  if (URL_BASE && !/^https?:\/\//.test(URL_BASE)) URL_BASE = 'https://' + URL_BASE;
  const ANON_KEY = String(CONFIG.SUPABASE_ANON_KEY || '').trim();
  const MODO = URL_BASE && ANON_KEY ? 'supabase' : 'demo';

  // ---------------------------------------------------------------------------
  // Sesión del administrador
  // El navegador NUNCA guarda la contraseña: solo un token aleatorio que entrega la
  // base de datos al iniciar sesión y que vence a los 10 minutos. La base de datos
  // vuelve a revisar el vencimiento en cada petición, así que cambiar la hora en el
  // navegador no alarga la sesión.
  // ---------------------------------------------------------------------------
  const CLAVE_SESION = 'konys_admin_sesion';
  const DURACION_SESION_MIN = 10;
  const MAX_INTENTOS = 5;          // intentos fallidos permitidos…
  const VENTANA_INTENTOS_MIN = 10; // …en esta ventana; después se bloquea el acceso

  // sessionStorage puede fallar si el navegador bloquea el almacenamiento: nunca debe romper la app
  function leerSesion() {
    try {
      const v = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
      return v && typeof v.token === 'string' && typeof v.expira === 'number' ? v : null;
    } catch (e) { return null; }
  }
  function guardarSesion(v) { try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function borrarSesion() {
    try {
      sessionStorage.removeItem(CLAVE_SESION);
      sessionStorage.removeItem('konys_admin_clave'); // versiones anteriores guardaban aquí la contraseña
    } catch (e) { /* sin almacenamiento */ }
  }
  try { sessionStorage.removeItem('konys_admin_clave'); } catch (e) { /* sin almacenamiento */ }
  /** Token de la sesión si no ha vencido; si venció lo borra */
  function tokenVigente() {
    const v = leerSesion();
    if (!v) return null;
    if (v.expira <= Date.now()) { borrarSesion(); return null; }
    return v.token;
  }

  // ---------------------------------------------------------------------------
  // Utilidades de fecha y hora (siempre en hora local del navegador)
  // ---------------------------------------------------------------------------
  const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DIAS_LEGIBLES = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const pad = n => String(n).padStart(2, '0');

  /** Date → 'AAAA-MM-DD' */
  function fechaISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /** 'AAAA-MM-DD' → Date local (sin desfase de zona horaria) */
  function parseFecha(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  /** 'HH:MM[:SS]' → minutos desde medianoche */
  function aMinutos(h) { const p = h.split(':').map(Number); return p[0] * 60 + p[1]; }

  /** minutos → 'HH:MM' */
  function aHora(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }

  /** '19:00' → '7:00 p. m.' */
  function hora12(h) {
    const m = aMinutos(h);
    let hh = Math.floor(m / 60);
    const suf = hh >= 12 ? 'p. m.' : 'a. m.';
    hh = hh % 12 || 12;
    return hh + ':' + pad(m % 60) + ' ' + suf;
  }

  /** '2026-10-17' → 'sábado 17 de octubre de 2026' */
  function fechaLarga(iso) {
    const d = parseFecha(iso);
    return DIAS_LEGIBLES[DIAS[d.getDay()]].toLowerCase() + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /** '2026-10-17' → '17/10/2026' */
  function fechaCorta(iso) { const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  function diaSemana(iso) { return DIAS[parseFecha(iso).getDay()]; }

  function precioCOP(n) { return '$' + Number(n).toLocaleString('es-CO'); }

  /**
   * Genera los slots de una fecha a partir de los horarios activos (RF-11, RF-04).
   * Devuelve [{ jornada, inicio:'12:30', fin:'13:30' }, …]
   */
  function generarSlots(horarios, fecha) {
    const dia = diaSemana(fecha);
    const slots = [];
    horarios
      .filter(h => h.activo && h.dia_semana === dia)
      .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))
      .forEach(h => {
        const fin = aMinutos(h.hora_fin);
        for (let t = aMinutos(h.hora_inicio); t + h.duracion_slot <= fin; t += h.duracion_slot) {
          slots.push({ jornada: h.jornada, inicio: aHora(t), fin: aHora(t + h.duracion_slot) });
        }
      });
    return slots;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /** Error con un código legible por la interfaz */
  function errorApp(codigo, mensaje) { const e = new Error(mensaje || codigo); e.codigo = codigo; return e; }

  /** Traduce errores de la base de datos a códigos de la aplicación */
  function traducirError(e) {
    const msg = (e && e.message) || '';
    if (msg.indexOf('CAPACIDAD_SUPERADA') >= 0) return errorApp('CAPACIDAD_SUPERADA', 'Se superó la capacidad de la mesa.');
    if (msg.indexOf('MESA_INACTIVA') >= 0) return errorApp('MESA_INACTIVA', 'La mesa no está disponible.');
    if (msg.indexOf('FECHA_PASADA') >= 0) return errorApp('FECHA_PASADA', 'La fecha ya pasó.');
    if (msg.indexOf('BLOQUEADO') >= 0) return errorApp('BLOQUEADO', 'Demasiados intentos fallidos. Espera ' + VENTANA_INTENTOS_MIN + ' minutos e inténtalo de nuevo.');
    if (msg.indexOf('FECHA_FUERA_DE_RANGO') >= 0) return errorApp('FECHA_FUERA_DE_RANGO', 'Solo se puede reservar hasta 30 días adelante.');
    if (msg.indexOf('FUERA_DE_HORARIO') >= 0) return errorApp('FUERA_DE_HORARIO', 'Ese horario no está dentro de la atención del restaurante.');
    if (e && e.code === '23505' && /nombre_unico/.test(msg)) return errorApp('DUPLICADO', 'Ya existe un registro con ese nombre.');
    if (e && (e.code === '23514' || e.code === '22P02' || e.code === '22007' || e.code === '22008' || e.code === '22003')) {
      return errorApp('DATO_INVALIDO', 'Algún dato no tiene el formato correcto. Revisa los campos e inténtalo de nuevo.');
    }
    if (e && e.code === '23505') return errorApp('SLOT_OCUPADO', 'Ese horario acaba de ser reservado.');
    if (e && e.code === '23503') return errorApp('TIENE_RESERVAS', 'La mesa tiene reservas asociadas.');
    if (e && /api key/i.test(msg)) return errorApp('CONFIG', 'La key de Supabase no es válida. Revisa SUPABASE_ANON_KEY.');
    if (e && (e.code === '42501' || e.status === 401 || e.status === 403)) return errorApp('NO_AUTORIZADO', 'No autorizado.');
    if (e && e.codigo) return e;
    if (e && e.status === 404) return errorApp('CONFIG', 'Supabase no encontró el recurso (404). Revisa SUPABASE_URL y que esquema.sql se haya ejecutado.');
    if (e && e.status) return errorApp('SERVIDOR', 'El servidor respondió con un error (' + e.status + '). ' + msg);
    return errorApp('RED', 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }

  // ---------------------------------------------------------------------------
  // Backend 1: Supabase (API REST de PostgREST)
  // ---------------------------------------------------------------------------
  async function rest(ruta, opciones) {
    opciones = opciones || {};
    const headers = {
      apikey: ANON_KEY,
      'Content-Type': 'application/json'
    };
    // La anon key antigua (JWT, empieza con "eyJ") también va como Bearer.
    // La publishable key nueva ("sb_publishable_…") solo va en apikey.
    if (ANON_KEY.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + ANON_KEY;
    if (opciones.prefer) headers.Prefer = opciones.prefer;
    const token = tokenVigente();
    if (token) headers['x-admin-token'] = token;

    const pedir = () => fetch(URL_BASE + '/rest/v1/' + ruta, {
      method: opciones.method || 'GET',
      headers: headers,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined
    });
    let res;
    try {
      res = await pedir();
    } catch (e) {
      // Un corte momentáneo de red: se reintenta una vez solo en lecturas
      if ((opciones.method || 'GET') === 'GET') {
        await new Promise(r => setTimeout(r, 800));
        try { res = await pedir(); } catch (e2) { e = e2; }
      }
      if (!res) {
        console.error('Supabase: fallo de red en', ruta, e);
        throw errorApp('RED', 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      }
    }
    // Justo después de ejecutar SQL, Supabase recarga su catálogo y responde 404 (PGRST2xx)
    // durante unos segundos: en lecturas se espera y se reintenta antes de mostrar error.
    const esLectura = (opciones.method || 'GET') === 'GET' || ruta.indexOf('rpc/') === 0;
    for (let intento = 0; res.status === 404 && esLectura && intento < 3; intento++) {
      await new Promise(r => setTimeout(r, 1500));
      try { res = await pedir(); } catch (e) { break; }
    }
    if (!res.ok) {
      const det = await res.json().catch(() => ({}));
      console.error('Supabase respondió ' + res.status + ' en ' + ruta, det);
      const e = new Error(det.message || res.statusText);
      e.code = det.code; e.status = res.status;
      throw traducirError(e);
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  const enc = encodeURIComponent;

  const supabaseApi = {
    listarMesas: (o) => rest('mesas?select=*&order=nombre.asc' + (o && o.soloActivas ? '&activa=eq.true' : '')),
    crearMesa: (m) => rest('mesas', { method: 'POST', body: m, prefer: 'return=minimal' }),
    actualizarMesa: (id, c) => rest('mesas?id=eq.' + enc(id), { method: 'PATCH', body: c, prefer: 'return=minimal' }),
    borrarMesa: (id) => rest('mesas?id=eq.' + enc(id), { method: 'DELETE' }),

    listarHorarios: () => rest('horarios?select=*'),
    crearHorario: (h) => rest('horarios', { method: 'POST', body: h, prefer: 'return=minimal' }),
    actualizarHorario: (id, c) => rest('horarios?id=eq.' + enc(id), { method: 'PATCH', body: c, prefer: 'return=minimal' }),
    borrarHorario: (id) => rest('horarios?id=eq.' + enc(id), { method: 'DELETE' }),

    listarPlatos: (o) => rest('platos?select=*&order=categoria.asc,nombre.asc' + (o && o.soloDisponibles ? '&disponible=eq.true' : '')),
    crearPlato: (p) => rest('platos', { method: 'POST', body: p, prefer: 'return=minimal' }),
    actualizarPlato: (id, c) => rest('platos?id=eq.' + enc(id), { method: 'PATCH', body: c, prefer: 'return=minimal' }),
    borrarPlato: (id) => rest('platos?id=eq.' + enc(id), { method: 'DELETE' }),

    /** Horas de inicio ocupadas. mesaId opcional (sin él, devuelve las de todas las mesas). */
    async ocupados(fecha, mesaId) {
      const filas = await rest('slots_ocupados?select=mesa_id,hora_inicio&fecha=eq.' + enc(fecha) + (mesaId ? '&mesa_id=eq.' + enc(mesaId) : ''));
      return filas.map(f => ({ mesa_id: f.mesa_id, hora: f.hora_inicio.slice(0, 5) }));
    },

    async crearReserva(r) {
      // El id se genera en el navegador porque el cliente no tiene permiso de lectura sobre reservas.
      const fila = Object.assign({ id: uuid(), estado: 'confirmada' }, r);
      await rest('reservas', { method: 'POST', body: fila, prefer: 'return=minimal' });
      return fila;
    },

    listarReservas(f) {
      f = f || {};
      let q = 'reservas?select=*,mesa:mesas(nombre,zona)&order=fecha.asc,hora_inicio.asc';
      if (f.fecha) q += '&fecha=eq.' + enc(f.fecha);
      if (f.mesaId) q += '&mesa_id=eq.' + enc(f.mesaId);
      if (f.estado) q += '&estado=eq.' + enc(f.estado);
      return rest(q);
    },
    actualizarReserva: (id, c) => rest('reservas?id=eq.' + enc(id), { method: 'PATCH', body: c, prefer: 'return=minimal' }),

    /** Envía la contraseña una sola vez; la base de datos devuelve un token que vence a los 10 minutos */
    async iniciarSesion(clave) {
      borrarSesion();
      const r = await rest('rpc/iniciar_sesion', { method: 'POST', body: { p_clave: clave } });
      if (!r || !r.token) return false;
      // El vencimiento se cuenta con los segundos que informa el servidor (no depende del reloj del equipo)
      guardarSesion({ token: r.token, expira: Date.now() + Number(r.segundos) * 1000 });
      return true;
    },
    verificarAdmin: () => (tokenVigente() ? rest('rpc/verificar_admin', { method: 'POST', body: {} }) : Promise.resolve(false)),
    async cerrarSesion() {
      try { if (tokenVigente()) await rest('rpc/cerrar_sesion', { method: 'POST', body: {} }); } catch (e) { /* igual se borra en el navegador */ }
      borrarSesion();
    }
  };

  // ---------------------------------------------------------------------------
  // Backend 2: modo demostración (localStorage), con los mismos datos iniciales que esquema.sql
  // ---------------------------------------------------------------------------
  const CLAVE_DEMO = 'konys_demo_v2';
  // Solo el hash SHA-256 de la contraseña de prueba (la contraseña está en el README, no en el código)
  const HASH_ADMIN_DEMO = '5288c1614b2ad0a9d18d853308c9b0c452327183d4bac2ba1cc56691016d535b';
  const CLAVE_SESIONES_DEMO = 'konys_demo_sesiones';  // hace las veces de la tabla sesiones_admin
  const CLAVE_INTENTOS_DEMO = 'konys_demo_intentos';  // hace las veces de la tabla intentos_acceso

  function semilla() {
    const mesas = [
      ['Mesa 1', 'terraza', 4, true], ['Mesa 2', 'terraza', 2, true], ['Mesa 3', 'salon', 6, true],
      ['Mesa 4', 'salon', 4, true], ['Mesa 5', 'salon', 8, true], ['Mesa 6', 'terraza', 4, true],
      ['Mesa 7', 'salon', 2, true], ['Mesa 8', 'terraza', 6, true], ['Mesa 9', 'terraza', 4, false]
    ].map(m => ({ id: uuid(), nombre: m[0], zona: m[1], capacidad: m[2], activa: m[3], foto_url: null, creado_en: new Date().toISOString() }));

    // Horario real de la sede El Prado: lunes a sábado almuerzo y noche, domingo solo noche
    const horarios = [];
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(d => {
      if (d !== 'domingo') horarios.push({ id: uuid(), dia_semana: d, jornada: 'almuerzo', hora_inicio: '11:30', hora_fin: '14:00', duracion_slot: 60, activo: true });
      horarios.push({ id: uuid(), dia_semana: d, jornada: 'noche', hora_inicio: '16:30', hora_fin: '23:00', duracion_slot: 60, activo: true });
    });

    // Carta real de la sede El Prado (pizzas en cono de 18 cm)
    const platos = [
      ['Konys Chicken', 'pizzas', 'Pollo en cuadros y maíz.', 29900, true],
      ['Konys Mary Tierra', 'pizzas', 'Camarón, pollo, pimentón y maíz.', 31900, true],
      ['Konys BBQ', 'pizzas', 'Pollo en salsa BBQ y cebolla caramelizada.', 29900, true],
      ['Konys Hawaiana', 'pizzas', 'Tocineta, jamón ahumado y piña.', 29900, true],
      ['Konys Bucara', 'pizzas', 'Carne Angus y mermelada de tocineta ahumada.', 31900, true],
      ['Konys Carnes', 'pizzas', 'Pepperoni, jamón ahumado y cabano.', 29900, true],
      ['Konys Mexicana', 'pizzas', 'Carne molida, maíz, pimentón, cebolla y un toque picante.', 29900, true],
      ['Konys Especial', 'pizzas', 'Pollo, tocineta, jamón y champiñón.', 30900, true],
      ['Konys Marinera', 'pizzas', 'Camarón, pulpo, palmito y salsa especial.', 31900, true],
      ['Konys Vegetariana', 'pizzas', 'Champiñones, tomate, maíz, cebolla caramelizada y parmesano.', 24000, false],
      ['Papas francesas al horno', 'entradas', 'Porción de 200 g, horneadas.', 10000, true],
      ['Pan de ajo', 'entradas', 'Porción de pan de ajo.', 2500, true],
      ['Limonada de panela', 'bebidas', 'Limonada natural endulzada con panela.', 7000, true],
      ['Coca-Cola 400 ml', 'bebidas', 'Gaseosa Coca-Cola Original.', 5000, true]
    ].map(p => ({ id: uuid(), nombre: p[0], categoria: p[1], descripcion: p[2], precio: p[3], disponible: p[4] }));

    // Algunas reservas de ejemplo para hoy y mañana, para ver slots ocupados
    const hoy = new Date();
    const man = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    const r = (mesa, nombre, contacto, n, fecha, ini, fin, estado) => ({
      id: uuid(), mesa_id: mesas[mesa].id, cliente_nombre: nombre, cliente_contacto: contacto, num_personas: n,
      fecha: fechaISO(fecha), hora_inicio: ini, hora_fin: fin, estado: estado, creado_en: new Date().toISOString()
    });
    const reservas = [
      r(2, 'Juan Pérez', '300 000 0001', 4, man, '19:30', '20:30', 'confirmada'),
      r(0, 'María Gómez', null, 2, man, '19:30', '20:30', 'confirmada'),
      r(3, 'Laura Díaz', '300 000 0003', 4, man, '20:30', '21:30', 'cancelada'),
      r(1, 'Andrés Rojas', '300 000 0004', 2, hoy, '12:30', '13:30', 'completada'),
      r(4, 'Sofía Ruiz', null, 6, man, '21:30', '22:30', 'confirmada'),
      r(7, 'Camilo Pardo', '300 000 0006', 3, hoy, '20:30', '21:30', 'confirmada'),
      r(6, 'Valentina Ortiz', '300 000 0007', 2, hoy, '18:30', '19:30', 'confirmada'),
      r(6, 'Diego Suárez', null, 2, hoy, '19:30', '20:30', 'confirmada'),
      r(6, 'Paula Méndez', '300 000 0009', 2, hoy, '20:30', '21:30', 'confirmada'),
      r(6, 'Felipe Castro', null, 2, hoy, '21:30', '22:30', 'confirmada')
    ];
    return { mesas: mesas, horarios: horarios, platos: platos, reservas: reservas };
  }

  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE_DEMO));
      if (d && d.mesas) return d;
    } catch (e) { /* datos dañados: se regeneran */ }
    const d = semilla();
    guardar(d);
    return d;
  }
  function guardar(d) { try { localStorage.setItem(CLAVE_DEMO, JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } }

  // Simula la latencia de red para que la interfaz muestre sus estados de carga
  const espera = (v) => new Promise(res => setTimeout(() => res(v), 150));
  const copia = (v) => JSON.parse(JSON.stringify(v));

  function leerLS(k, porDefecto) { try { return JSON.parse(localStorage.getItem(k)) || porDefecto; } catch (e) { return porDefecto; } }
  function guardarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  async function sha256(texto) {
    if (!(window.crypto && crypto.subtle)) throw errorApp('CONFIG', 'Abre la app desde localhost o desde https para poder iniciar sesión.');
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  /** Igual que es_admin() en la base de datos: el token debe existir y no haber vencido */
  function exigirAdmin() {
    const t = tokenVigente();
    const ok = t && leerLS(CLAVE_SESIONES_DEMO, []).some(s => s.token === t && s.expira > Date.now());
    if (!ok) throw errorApp('NO_AUTORIZADO', 'Tu sesión expiró. Ingresa de nuevo.');
  }
  // Igual que los índices únicos mesas_nombre_unico y platos_nombre_unico de la base de datos
  function nombreLibre(lista, nombre, idPropio) {
    if (nombre == null) return;
    const n = String(nombre).trim().toLowerCase();
    if (lista.some(x => x.id !== idPropio && String(x.nombre).trim().toLowerCase() === n)) throw errorApp('DUPLICADO', 'Ya existe un registro con ese nombre.');
  }
  function actualizarEn(lista, id, cambios) {
    const i = lista.findIndex(x => x.id === id);
    if (i < 0) throw errorApp('NO_ENCONTRADO', 'Registro no encontrado.');
    Object.assign(lista[i], cambios);
  }

  const demoApi = {
    async listarMesas(o) {
      const d = leer();
      let m = d.mesas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
      if (o && o.soloActivas) m = m.filter(x => x.activa);
      return espera(copia(m));
    },
    async crearMesa(m) { exigirAdmin(); const d = leer(); nombreLibre(d.mesas, m.nombre); d.mesas.push(Object.assign({ id: uuid(), creado_en: new Date().toISOString(), activa: true }, m)); guardar(d); return espera(null); },
    async actualizarMesa(id, c) { exigirAdmin(); const d = leer(); nombreLibre(d.mesas, c.nombre, id); actualizarEn(d.mesas, id, c); guardar(d); return espera(null); },
    async borrarMesa(id) {
      exigirAdmin();
      const d = leer();
      if (d.reservas.some(r => r.mesa_id === id)) throw errorApp('TIENE_RESERVAS', 'La mesa tiene reservas asociadas.');
      d.mesas = d.mesas.filter(m => m.id !== id); guardar(d); return espera(null);
    },

    async listarHorarios() { return espera(copia(leer().horarios)); },
    async crearHorario(h) {
      exigirAdmin();
      const d = leer();
      if (d.horarios.some(x => x.dia_semana === h.dia_semana && x.jornada === h.jornada)) throw errorApp('DUPLICADO', 'Ya existe esa jornada para ese día.');
      d.horarios.push(Object.assign({ id: uuid() }, h)); guardar(d); return espera(null);
    },
    async actualizarHorario(id, c) { exigirAdmin(); const d = leer(); actualizarEn(d.horarios, id, c); guardar(d); return espera(null); },
    async borrarHorario(id) { exigirAdmin(); const d = leer(); d.horarios = d.horarios.filter(h => h.id !== id); guardar(d); return espera(null); },

    async listarPlatos(o) {
      let p = leer().platos.slice().sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
      if (o && o.soloDisponibles) p = p.filter(x => x.disponible);
      return espera(copia(p));
    },
    async crearPlato(p) { exigirAdmin(); const d = leer(); nombreLibre(d.platos, p.nombre); d.platos.push(Object.assign({ id: uuid() }, p)); guardar(d); return espera(null); },
    async actualizarPlato(id, c) { exigirAdmin(); const d = leer(); nombreLibre(d.platos, c.nombre, id); actualizarEn(d.platos, id, c); guardar(d); return espera(null); },
    async borrarPlato(id) { exigirAdmin(); const d = leer(); d.platos = d.platos.filter(p => p.id !== id); guardar(d); return espera(null); },

    async ocupados(fecha, mesaId) {
      const r = leer().reservas.filter(x => x.fecha === fecha && x.estado !== 'cancelada' && (!mesaId || x.mesa_id === mesaId));
      return espera(r.map(x => ({ mesa_id: x.mesa_id, hora: x.hora_inicio })));
    },

    async crearReserva(r) {
      const d = leer();
      const mesa = d.mesas.find(m => m.id === r.mesa_id);
      // Las mismas reglas que aplican el trigger y el índice único en Supabase
      // Igual que la política reservas_crear: el público solo crea reservas confirmadas
      if (r.estado && r.estado !== 'confirmada') throw errorApp('NO_AUTORIZADO', 'No autorizado.');
      if (!mesa || !mesa.activa) throw errorApp('MESA_INACTIVA', 'La mesa no está disponible.');
      if (r.num_personas > mesa.capacidad) throw errorApp('CAPACIDAD_SUPERADA', 'Se superó la capacidad de la mesa.');
      const hoy = fechaISO(new Date());
      const limite = new Date(); limite.setDate(limite.getDate() + 30);
      if (r.fecha < hoy) throw errorApp('FECHA_PASADA', 'La fecha ya pasó.');
      if (r.fecha > fechaISO(limite)) throw errorApp('FECHA_FUERA_DE_RANGO', 'Solo se puede reservar hasta 30 días adelante.');
      const dia = diaSemana(r.fecha);
      if (!d.horarios.some(h => h.activo && h.dia_semana === dia && aMinutos(r.hora_inicio) >= aMinutos(h.hora_inicio) && aMinutos(r.hora_fin) <= aMinutos(h.hora_fin))) {
        throw errorApp('FUERA_DE_HORARIO', 'Ese horario no está dentro de la atención del restaurante.');
      }
      if (d.reservas.some(x => x.mesa_id === r.mesa_id && x.fecha === r.fecha && x.hora_inicio === r.hora_inicio && x.estado !== 'cancelada')) {
        throw errorApp('SLOT_OCUPADO', 'Ese horario acaba de ser reservado.');
      }
      const fila = Object.assign({ id: uuid(), estado: 'confirmada', creado_en: new Date().toISOString() }, r);
      d.reservas.push(fila);
      guardar(d);
      return espera(copia(fila));
    },

    async listarReservas(f) {
      exigirAdmin();
      f = f || {};
      const d = leer();
      const mesas = {};
      d.mesas.forEach(m => { mesas[m.id] = m; });
      const r = d.reservas
        .filter(x => (!f.fecha || x.fecha === f.fecha) && (!f.mesaId || x.mesa_id === f.mesaId) && (!f.estado || x.estado === f.estado))
        .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
        .map(x => Object.assign({}, x, { mesa: mesas[x.mesa_id] ? { nombre: mesas[x.mesa_id].nombre, zona: mesas[x.mesa_id].zona } : null }));
      return espera(copia(r));
    },
    async actualizarReserva(id, c) { exigirAdmin(); const d = leer(); actualizarEn(d.reservas, id, c); guardar(d); return espera(null); },

    async iniciarSesion(clave) {
      borrarSesion();
      const ahora = Date.now();
      const intentos = leerLS(CLAVE_INTENTOS_DEMO, []).filter(t => t > ahora - VENTANA_INTENTOS_MIN * 60000);
      if (intentos.length >= MAX_INTENTOS) {
        throw errorApp('BLOQUEADO', 'Demasiados intentos fallidos. Espera ' + VENTANA_INTENTOS_MIN + ' minutos e inténtalo de nuevo.');
      }
      if (typeof clave !== 'string' || await sha256(clave) !== HASH_ADMIN_DEMO) {
        guardarLS(CLAVE_INTENTOS_DEMO, intentos.concat([ahora]));
        return espera(false);
      }
      guardarLS(CLAVE_INTENTOS_DEMO, []);
      const s = { token: uuid(), expira: ahora + DURACION_SESION_MIN * 60000 };
      guardarLS(CLAVE_SESIONES_DEMO, leerLS(CLAVE_SESIONES_DEMO, []).filter(x => x.expira > ahora).concat([s]));
      guardarSesion(s);
      return espera(true);
    },
    async verificarAdmin() {
      try { exigirAdmin(); return espera(true); } catch (e) { return espera(false); }
    },
    async cerrarSesion() {
      const v = leerSesion();
      if (v) guardarLS(CLAVE_SESIONES_DEMO, leerLS(CLAVE_SESIONES_DEMO, []).filter(x => x.token !== v.token));
      borrarSesion();
      return espera(null);
    },

    reiniciar() { localStorage.removeItem(CLAVE_DEMO); }
  };

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------
  const api = MODO === 'supabase' ? supabaseApi : demoApi;

  // Antes de guardar se revisa cada dato con las mismas reglas de la base de datos (js/validacion.js).
  // Así un dato mal formado nunca sale del navegador, aunque se salte el formulario.
  const V = window.KonysValidacion;
  [
    ['crearReserva', 'reserva', 0, false], ['actualizarReserva', 'reserva', 1, true],
    ['crearMesa', 'mesa', 0, false], ['actualizarMesa', 'mesa', 1, true],
    ['crearPlato', 'plato', 0, false], ['actualizarPlato', 'plato', 1, true],
    ['crearHorario', 'horario', 0, false], ['actualizarHorario', 'horario', 1, true]
  ].forEach(([metodo, tipo, pos, parcial]) => {
    const original = api[metodo];
    api[metodo] = function () {
      const datos = arguments[pos];
      const err = !datos || typeof datos !== 'object' ? 'Datos vacíos.' : (V ? V.registro[tipo](datos, parcial) : '');
      if (err) return Promise.reject(errorApp('DATO_INVALIDO', err));
      return original.apply(this, arguments);
    };
  });

  window.Konys = {
    modo: MODO,
    datos: api,
    cerrarSesionAdmin: borrarSesion,
    haySesionAdmin: () => !!tokenVigente(),
    /** Segundos que le quedan a la sesión (0 si no hay o ya venció) */
    segundosSesionAdmin: () => { const v = leerSesion(); return v ? Math.max(0, Math.ceil((v.expira - Date.now()) / 1000)) : 0; },
    DURACION_SESION_MIN: DURACION_SESION_MIN,
    validar: V,
    util: {
      fechaISO, parseFecha, aMinutos, aHora, hora12, fechaLarga, fechaCorta, diaSemana, precioCOP, generarSlots,
      DIAS, DIAS_LEGIBLES, MESES,
      ZONAS: { terraza: 'Terraza', salon: 'Salón' },
      CATEGORIAS: { pizzas: 'Pizzas', entradas: 'Entradas', postres: 'Postres', bebidas: 'Bebidas' },
      JORNADAS: { almuerzo: 'Almuerzo', noche: 'Noche' },
      ESTADOS: { confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada' }
    }
  };
})();
