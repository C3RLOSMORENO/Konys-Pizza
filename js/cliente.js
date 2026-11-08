// =============================================================================
// Konys Pizza · Módulo cliente (index.html)
// RF-01 mesas · RF-02 selección · RF-03 fecha · RF-04 horarios · RF-05 reserva
// RF-06 confirmación · RF-07 carta digital
// =============================================================================
(function () {
  'use strict';

  const D = window.Konys.datos;
  const U = window.Konys.util;
  const V = window.Konys.validar;
  const $ = (sel) => document.querySelector(sel);

  // Cuántos días hacia adelante se puede reservar
  const DIAS_RESERVABLES = 30;

  // Fotos reales de la sede El Prado (ver img/CREDITOS.md)
  const FOTOS_ZONA = { salon: ['img/salon.jpg', 'img/salon-2.jpg'], terraza: ['img/terraza.jpg'] };
  const FOTOS_CATEGORIA = { pizzas: 'img/conos.jpg', entradas: 'img/combo.jpg', bebidas: 'img/bebidas.jpg' };

  const estado = {
    mesas: [],
    platos: [],
    horarios: [],
    ocupadosHoy: [],
    zona: '',
    categoria: '',
    // flujo de reserva
    mesa: null,
    fecha: null,
    slot: null,
    mes: null,
    disparador: null
  };

  // ---------------------------------------------------------------------------
  // Utilidades de interfaz
  // ---------------------------------------------------------------------------
  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function icono(nombre, extra) {
    return '<svg class="icono ' + (extra || '') + '" aria-hidden="true"><use href="#i-' + nombre + '"/></svg>';
  }
  function alerta(tipo, titulo, mensaje) {
    const ic = tipo === 'error' ? 'alerta' : 'info';
    return '<div class="alerta alerta--' + tipo + '" role="alert">' + icono(ic) +
      '<div><strong>' + escapar(titulo) + '</strong><p>' + escapar(mensaje) + '</p></div></div>';
  }
  let temporizadorToast;
  function toast(msg, error) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function hoyISO() { return U.fechaISO(new Date()); }
  function minutosAhora() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  /** Slots de una fecha con su estado (ocupado si ya está reservado o si la hora ya pasó) */
  function slotsConEstado(fecha, ocupadas) {
    const esHoy = fecha === hoyISO();
    const ahora = minutosAhora();
    return U.generarSlots(estado.horarios, fecha).map(s => Object.assign({}, s, {
      ocupado: ocupadas.indexOf(s.inicio) >= 0 || (esHoy && U.aMinutos(s.inicio) <= ahora)
    }));
  }

  // ---------------------------------------------------------------------------
  // RF-01: mesas
  // ---------------------------------------------------------------------------
  function renderMesas() {
    const cont = $('#grilla-mesas');
    const lista = estado.mesas.filter(m => !estado.zona || m.zona === estado.zona);
    if (!lista.length) {
      cont.innerHTML = '<p class="vacio">No hay mesas disponibles en esta zona.</p>';
      return;
    }
    const hoy = hoyISO();
    cont.innerHTML = lista.map((m, i) => {
      const ocupadas = estado.ocupadosHoy.filter(o => o.mesa_id === m.id).map(o => o.hora);
      const libres = slotsConEstado(hoy, ocupadas).filter(s => !s.ocupado).length;
      const badge = libres > 0
        ? '<span class="badge badge--libre">Con cupo hoy</span>'
        : '<span class="badge badge--ocupada">Sin cupo hoy</span>';
      // Si la mesa no tiene foto propia, se usa una foto real de su zona
      const fotosZona = FOTOS_ZONA[m.zona] || [];
      const src = m.foto_url || fotosZona[i % (fotosZona.length || 1)];
      const foto = src
        ? '<img src="' + escapar(src) + '" alt="' + escapar(m.nombre) + ', ' + U.ZONAS[m.zona] + ' de Konys Pizza" loading="lazy">'
        : icono('mesa');
      return '<article class="mesa">' +
        '<div class="mesa__foto">' + foto + '</div>' +
        '<div class="mesa__cuerpo">' +
          '<div class="mesa__titulo"><h3>' + escapar(m.nombre) + '</h3>' + badge + '</div>' +
          '<p class="mesa__meta"><span>' + icono('ubicacion', 'icono-16') + U.ZONAS[m.zona] + '</span>' +
          '<span>' + icono('personas', 'icono-16') + m.capacidad + ' personas</span></p>' +
          '<button class="btn ' + (libres > 0 ? 'btn--primario' : 'btn--secundario') + '" data-mesa="' + m.id + '">Ver horarios</button>' +
        '</div></article>';
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // RF-07: carta digital (solo platos disponibles)
  // ---------------------------------------------------------------------------
  function renderCarta() {
    const cont = $('#carta-contenido');
    const cats = Object.keys(U.CATEGORIAS).filter(c => !estado.categoria || c === estado.categoria);
    const html = cats.map(c => {
      const platos = estado.platos.filter(p => p.categoria === c);
      if (!platos.length) return '';
      return '<div class="carta-grupo"><h3>' + U.CATEGORIAS[c] + '</h3><div class="grilla-platos">' +
        platos.map(p => '<article class="plato">' +
          '<div class="plato__foto">' + (FOTOS_CATEGORIA[c]
            ? '<img src="' + FOTOS_CATEGORIA[c] + '" alt="" loading="lazy">'
            : icono(c === 'bebidas' ? 'carta' : 'pizza')) + '</div>' +
          '<div><p class="plato__nombre">' + escapar(p.nombre) + '</p>' +
          '<p class="plato__desc">' + escapar(p.descripcion || '') + '</p>' +
          '<p class="plato__precio">' + U.precioCOP(p.precio) + '</p></div></article>').join('') +
        '</div></div>';
    }).join('');
    cont.innerHTML = html || '<p class="vacio">No hay platos en esta categoría por ahora.</p>';
  }

  // ---------------------------------------------------------------------------
  // RF-02 a RF-06: flujo de reserva
  // ---------------------------------------------------------------------------
  function abrirReserva(mesaId, disparador) {
    const mesa = estado.mesas.find(m => m.id === mesaId);
    if (!mesa) return;
    estado.mesa = mesa;
    estado.fecha = null;
    estado.slot = null;
    estado.disparador = disparador || null;
    const hoy = new Date();
    estado.mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    $('#modal-sobretitulo').textContent = 'Reservar';
    $('#modal-titulo').textContent = mesa.nombre + ' · ' + U.ZONAS[mesa.zona];
    $('#modal-meta').innerHTML = icono('personas', 'icono-16') + ' Hasta ' + mesa.capacidad + ' personas';
    $('#form-reserva').reset();
    $('#r-personas').max = mesa.capacidad;
    $('#a-personas').textContent = 'Máximo ' + mesa.capacidad + ' personas para esta mesa.';
    limpiarErrores();
    $('#alerta-slot').innerHTML = '';
    $('#alerta-form').innerHTML = '';
    $('#slots').innerHTML = '<p class="leyenda">Primero elige una fecha.</p>';
    $('#vista-reserva').hidden = false;
    $('#vista-confirmacion').hidden = true;
    $('#pasos').hidden = false;

    renderCalendario();
    actualizarResumen();
    $('#modal-reserva').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#modal-cerrar').focus();
  }

  function cerrarReserva() {
    $('#modal-reserva').hidden = true;
    document.body.style.overflow = '';
    if (estado.disparador) estado.disparador.focus();
  }

  /** ¿El restaurante atiende ese día y todavía quedan horarios? (RF-03) */
  function diaHabilitado(iso) {
    const hoy = hoyISO();
    const limite = new Date(); limite.setDate(limite.getDate() + DIAS_RESERVABLES);
    if (iso < hoy || iso > U.fechaISO(limite)) return false;
    const slots = slotsConEstado(iso, []);
    return slots.some(s => !s.ocupado);
  }

  function renderCalendario() {
    const m = estado.mes;
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimo = new Date(); ultimo.setDate(ultimo.getDate() + DIAS_RESERVABLES);
    const puedeAtras = m > primero;
    const puedeAdelante = new Date(m.getFullYear(), m.getMonth() + 1, 1) <= ultimo;

    let html = '<div class="calendario__mes">' +
      '<button class="btn-icono" data-mes="-1" aria-label="Mes anterior"' + (puedeAtras ? '' : ' disabled') + '>' + icono('chevron-izq') + '</button>' +
      '<span>' + U.MESES[m.getMonth()] + ' ' + m.getFullYear() + '</span>' +
      '<button class="btn-icono" data-mes="1" aria-label="Mes siguiente"' + (puedeAdelante ? '' : ' disabled') + '>' + icono('chevron-der') + '</button>' +
      '</div><div class="calendario__dias" role="grid">';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(d => { html += '<span class="calendario__sem" aria-hidden="true">' + d + '</span>'; });

    // Semana iniciando en lunes
    const desfase = (m.getDay() + 6) % 7;
    for (let i = 0; i < desfase; i++) html += '<span></span>';
    const diasMes = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const hoyIso = hoyISO();
    for (let d = 1; d <= diasMes; d++) {
      const iso = U.fechaISO(new Date(m.getFullYear(), m.getMonth(), d));
      const ok = diaHabilitado(iso);
      const cls = 'dia' + (iso === hoyIso ? ' dia--hoy' : '');
      html += '<button type="button" class="' + cls + '" data-fecha="' + iso + '"' +
        ' aria-pressed="' + (iso === estado.fecha) + '"' + (ok ? '' : ' disabled') +
        ' aria-label="' + U.fechaLarga(iso) + (ok ? '' : ', no disponible') + '">' + d + '</button>';
    }
    html += '</div>';
    $('#calendario').innerHTML = html;
  }

  async function elegirFecha(iso) {
    estado.fecha = iso;
    estado.slot = null;
    $('#alerta-slot').innerHTML = '';
    renderCalendario();
    actualizarResumen();
    await cargarSlots();
  }

  async function cargarSlots() {
    const cont = $('#slots');
    cont.innerHTML = '<p class="leyenda">Consultando disponibilidad…</p>';
    try {
      const ocup = await D.ocupados(estado.fecha, estado.mesa.id);
      renderSlots(ocup.map(o => o.hora));
    } catch (e) {
      cont.innerHTML = alerta('error', 'No pudimos cargar los horarios', e.message);
    }
  }

  function renderSlots(ocupadas) {
    const slots = slotsConEstado(estado.fecha, ocupadas);
    const cont = $('#slots');
    if (!slots.length) {
      cont.innerHTML = '<p class="vacio">No hay horarios de atención para este día.</p>';
      return;
    }
    const grupos = {};
    slots.forEach(s => { (grupos[s.jornada] = grupos[s.jornada] || []).push(s); });
    // El título usa la hora de apertura y cierre real de la jornada (tabla horarios)
    const dia = U.diaSemana(estado.fecha);
    const rango = (lista) => {
      const h = estado.horarios.find(x => x.activo && x.dia_semana === dia && x.jornada === lista[0].jornada);
      return h ? U.hora12(h.hora_inicio) + ' – ' + U.hora12(h.hora_fin) : U.hora12(lista[0].inicio) + ' – ' + U.hora12(lista[lista.length - 1].fin);
    };
    cont.innerHTML = Object.keys(grupos).map(j =>
      '<div class="bloque" style="gap:8px"><p class="jornada-titulo">' + U.JORNADAS[j] + ' · ' + rango(grupos[j]) + '</p>' +
      '<div class="slots">' + grupos[j].map(s =>
        '<button type="button" class="slot" data-slot="' + s.inicio + '" data-fin="' + s.fin + '"' +
        ' aria-pressed="' + (estado.slot && estado.slot.inicio === s.inicio) + '"' +
        (s.ocupado ? ' disabled aria-label="' + s.inicio + ', ocupado"' : '') + '>' +
        (estado.slot && estado.slot.inicio === s.inicio ? icono('check', 'icono-16') : '') + s.inicio + '</button>').join('') +
      '</div></div>').join('');
  }

  function elegirSlot(boton) {
    estado.slot = { inicio: boton.dataset.slot, fin: boton.dataset.fin };
    $('#alerta-slot').innerHTML = '';
    document.querySelectorAll('#slots .slot').forEach(b => {
      const sel = b === boton;
      b.setAttribute('aria-pressed', String(sel));
      const ic = b.querySelector('svg');
      if (ic) ic.remove();
      if (sel) b.insertAdjacentHTML('afterbegin', icono('check', 'icono-16'));
    });
    actualizarResumen();
    $('#r-nombre').focus({ preventScroll: true });
  }

  /** Mantiene sincronizados el indicador de pasos (RNF-01), el resumen y el botón */
  function actualizarResumen() {
    const paso = !estado.fecha ? 1 : !estado.slot ? 2 : 3;
    document.querySelectorAll('#pasos .paso').forEach(p => {
      const n = Number(p.dataset.paso);
      p.className = 'paso' + (n < paso ? ' paso--hecho' : n === paso ? ' paso--actual' : '');
      p.querySelector('.paso__num').innerHTML = n < paso ? icono('check', 'icono-16') : n;
    });
    const m = estado.mesa;
    $('#s-mesa').textContent = m ? m.nombre + ' · ' + U.ZONAS[m.zona] : '—';
    $('#s-fecha').textContent = estado.fecha ? U.fechaLarga(estado.fecha) : 'Elige una fecha';
    $('#s-hora').textContent = estado.slot ? U.hora12(estado.slot.inicio) + ' – ' + U.hora12(estado.slot.fin) : 'Elige un horario';
    const n = /^[0-9]+$/.test($('#r-personas').value) ? Number($('#r-personas').value) : 0;
    $('#s-personas').textContent = n > 0 ? n + (n === 1 ? ' persona' : ' personas') : '—';
    $('#btn-confirmar').disabled = !(estado.fecha && estado.slot);
  }

  const CAMPOS = ['nombre', 'contacto', 'personas'];
  function limpiarErrores() {
    CAMPOS.forEach(c => {
      $('#e-' + c).hidden = true;
      $('#r-' + c).removeAttribute('aria-invalid');
    });
  }
  function errorCampo(campo, msg) {
    const e = $('#e-' + campo);
    e.textContent = msg; e.hidden = false;
    const i = $('#r-' + campo);
    i.setAttribute('aria-invalid', 'true');
  }
  function quitarError(campo) {
    $('#e-' + campo).hidden = true;
    $('#r-' + campo).removeAttribute('aria-invalid');
  }

  /** Regla de cada campo: devuelve { valor, error } (ver js/validacion.js) */
  const REGLAS = {
    nombre: () => V.nombrePersona($('#r-nombre').value),
    contacto: () => V.telefono($('#r-contacto').value, true),
    personas: () => {
      const max = estado.mesa ? estado.mesa.capacidad : 30;
      return V.entero($('#r-personas').value, 1, max, {
        vacio: 'Indica cuántas personas vienen.',
        formato: 'Escribe solo números enteros (sin letras, puntos ni signos).',
        rango: 'Debe ser entre 1 y ' + max + ' personas para esta mesa.'
      });
    }
  };
  function validarCampo(c) {
    const r = REGLAS[c]();
    if (r.error) errorCampo(c, r.error); else quitarError(c);
    return r;
  }

  /** Validación del formulario (RF-05) */
  function validar() {
    const r = {};
    CAMPOS.forEach(c => { r[c] = validarCampo(c); });
    const ok = CAMPOS.every(c => !r[c].error);
    if (!ok) { const p = document.querySelector('#form-reserva [aria-invalid="true"]'); if (p) p.focus(); return null; }
    // Se muestran los datos ya normalizados (espacios de más, teléfono con formato)
    $('#r-nombre').value = r.nombre.valor;
    $('#r-contacto').value = r.contacto.valor || '';
    return { nombre: r.nombre.valor, personas: r.personas.valor, contacto: r.contacto.valor };
  }

  async function confirmar(ev) {
    ev.preventDefault();
    $('#alerta-form').innerHTML = '';
    const datos = validar();
    if (!datos || !estado.slot) return;
    const btn = $('#btn-confirmar');
    btn.disabled = true;
    btn.lastChild.textContent = ' Confirmando…';
    try {
      // Paso 10 del flujo (§12.1): verificar de nuevo que el slot siga libre antes de guardar.
      // El índice único de la base de datos cubre el caso de dos envíos simultáneos (§12.2).
      const ocup = (await D.ocupados(estado.fecha, estado.mesa.id)).map(o => o.hora);
      if (ocup.indexOf(estado.slot.inicio) >= 0) throw Object.assign(new Error(), { codigo: 'SLOT_OCUPADO' });

      const reserva = await D.crearReserva({
        mesa_id: estado.mesa.id,
        cliente_nombre: datos.nombre,
        cliente_contacto: datos.contacto || null,
        num_personas: datos.personas,
        fecha: estado.fecha,
        hora_inicio: estado.slot.inicio,
        hora_fin: estado.slot.fin
      });
      mostrarConfirmacion(reserva, datos);
      cargarOcupadosHoy();
    } catch (e) {
      if (e.codigo === 'SLOT_OCUPADO') {
        // Flujo alternativo CU-02 (paso 7)
        const hora = estado.slot.inicio;
        estado.slot = null;
        actualizarResumen();
        $('#alerta-slot').innerHTML = alerta('error', 'Ese horario acaba de ser reservado', 'Otra persona tomó las ' + hora + ' hace un momento. Elige otro horario.');
        await cargarSlots();
        $('#alerta-slot').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.codigo === 'CAPACIDAD_SUPERADA') {
        errorCampo('personas', 'Máximo ' + estado.mesa.capacidad + ' personas para esta mesa.');
      } else if (e.codigo === 'DATO_INVALIDO') {
        $('#alerta-form').innerHTML = alerta('error', 'Revisa tus datos', e.message);
      } else if (e.codigo === 'FECHA_PASADA' || e.codigo === 'FECHA_FUERA_DE_RANGO' || e.codigo === 'FUERA_DE_HORARIO') {
        $('#alerta-form').innerHTML = alerta('error', 'Ese horario ya no se puede reservar', e.message + ' Elige otra fecha u hora.');
      } else if (e.codigo === 'MESA_INACTIVA') {
        $('#alerta-form').innerHTML = alerta('error', 'Esta mesa ya no está disponible', 'Cierra esta ventana y elige otra mesa.');
      } else {
        $('#alerta-form').innerHTML = alerta('error', 'No pudimos guardar tu reserva', e.message || 'Inténtalo de nuevo en unos segundos.');
      }
    } finally {
      btn.lastChild.textContent = ' Confirmar reserva';
      actualizarResumen();
    }
  }

  /** RF-06: comprobante visual */
  function mostrarConfirmacion(r, datos) {
    const codigo = 'KP-' + r.fecha.slice(5).replace('-', '') + '-' + r.hora_inicio.replace(':', '') + '-' + String(r.id).slice(0, 4).toUpperCase();
    const filas = [
      ['Código', codigo],
      ['Nombre', datos.nombre],
      ['Mesa', estado.mesa.nombre + ' · ' + U.ZONAS[estado.mesa.zona]],
      ['Fecha', U.fechaLarga(r.fecha)],
      ['Hora', U.hora12(r.hora_inicio) + ' – ' + U.hora12(r.hora_fin)],
      ['Personas', String(datos.personas)]
    ];
    if (datos.contacto) filas.push(['Contacto', datos.contacto]);
    $('#detalle-reserva').innerHTML = filas.map(f => '<div><dt>' + f[0] + '</dt><dd>' + escapar(f[1]) + '</dd></div>').join('');
    $('#modal-sobretitulo').textContent = 'Comprobante';
    $('#vista-reserva').hidden = true;
    $('#pasos').hidden = true;
    $('#vista-confirmacion').hidden = false;
    $('#vista-confirmacion').focus();
  }

  // ---------------------------------------------------------------------------
  // Carga inicial
  // ---------------------------------------------------------------------------
  async function cargarOcupadosHoy() {
    try {
      estado.ocupadosHoy = await D.ocupados(hoyISO());
    } catch (e) { estado.ocupadosHoy = []; }
    renderMesas();
  }

  async function iniciar() {
    if (window.Konys.modo === 'demo') $('#banner-demo').hidden = false;
    try {
      const r = await Promise.all([D.listarMesas({ soloActivas: true }), D.listarHorarios(), D.listarPlatos({ soloDisponibles: true })]);
      estado.mesas = r[0];
      estado.horarios = r[1];
      estado.platos = r[2];
      // Solo se muestran los filtros de categorías que tienen platos
      document.querySelectorAll('#filtro-categoria [data-categoria]').forEach(b => {
        b.hidden = !!b.dataset.categoria && !estado.platos.some(p => p.categoria === b.dataset.categoria);
      });
      renderCarta();
      await cargarOcupadosHoy();
    } catch (e) {
      $('#grilla-mesas').innerHTML = alerta('error', 'No pudimos cargar las mesas', e.message) +
        '<button class="btn btn--secundario" id="btn-reintentar" style="margin-top:12px">Reintentar</button>';
      $('#carta-contenido').innerHTML = '';
      $('#btn-reintentar').addEventListener('click', () => {
        $('#grilla-mesas').innerHTML = '<p class="cargando">Cargando mesas…</p>';
        iniciar();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  $('#nav-toggle').addEventListener('click', () => {
    const nav = $('#nav');
    const abierta = nav.classList.toggle('abierta');
    $('#nav-toggle').setAttribute('aria-expanded', String(abierta));
  });
  $('#nav').addEventListener('click', (e) => {
    if (e.target.closest('a')) { $('#nav').classList.remove('abierta'); $('#nav-toggle').setAttribute('aria-expanded', 'false'); }
  });

  $('#filtro-zona').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    estado.zona = b.dataset.zona;
    document.querySelectorAll('#filtro-zona .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderMesas();
  });
  $('#filtro-categoria').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    estado.categoria = b.dataset.categoria;
    document.querySelectorAll('#filtro-categoria .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderCarta();
  });

  $('#grilla-mesas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mesa]');
    if (b) abrirReserva(b.dataset.mesa, b);
  });

  $('#calendario').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-mes]');
    if (nav) {
      estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + Number(nav.dataset.mes), 1);
      renderCalendario();
      return;
    }
    const d = e.target.closest('[data-fecha]');
    if (d && !d.disabled) elegirFecha(d.dataset.fecha);
  });

  $('#slots').addEventListener('click', (e) => {
    const b = e.target.closest('.slot');
    if (b && !b.disabled) elegirSlot(b);
  });

  // Al corregir un campo se quita su mensaje de error; al salir del campo se revisa
  CAMPOS.forEach(c => {
    const i = $('#r-' + c);
    i.addEventListener('input', () => { quitarError(c); actualizarResumen(); });
    i.addEventListener('blur', () => { if (i.value.trim()) validarCampo(c); });
  });
  // Bloquea al escribir o pegar lo que no corresponde a cada campo (letras en números, etc.)
  V.filtrar($('#r-nombre'), 'nombrePersona', m => errorCampo('nombre', m));
  V.filtrar($('#r-contacto'), 'telefono', m => errorCampo('contacto', m));
  V.filtrar($('#r-personas'), 'digitos', m => errorCampo('personas', m));
  $('#form-reserva').addEventListener('submit', confirmar);
  $('#modal-cerrar').addEventListener('click', cerrarReserva);
  $('#modal-reserva').addEventListener('click', (e) => { if (e.target.id === 'modal-reserva') cerrarReserva(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-reserva').hidden) cerrarReserva(); });
  $('#btn-volver').addEventListener('click', () => { cerrarReserva(); location.hash = '#inicio'; });
  $('#btn-ver-carta').addEventListener('click', () => { cerrarReserva(); $('#carta').scrollIntoView({ behavior: 'smooth' }); });

  iniciar();
  window.KonysCliente = { toast: toast };
})();
