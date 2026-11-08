// =============================================================================
// Konys Pizza · Módulo administrador (admin.html → /admin)
// RF-08 acceso · RF-09 registro de mesas · RF-10 listado · RF-11 horarios
// RF-12 reservas · RF-13 estado de mesa · RF-14 carta
// =============================================================================
(function () {
  'use strict';

  const K = window.Konys;
  const D = K.datos;
  const U = K.util;
  const V = K.validar;
  const $ = (sel) => document.querySelector(sel);

  const estado = {
    mesas: [],
    horarios: [],
    platos: [],
    zonaMesas: '',
    categoriaPlatos: '',
    horariosCambiados: {},  // id → cambios pendientes
    editandoMesa: null,
    editandoPlato: null
  };

  // ---------------------------------------------------------------------------
  // Utilidades de interfaz
  // ---------------------------------------------------------------------------
  function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function icono(n) { return '<svg class="icono" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function btnIcono(accion, icon, etiqueta, id, peligro) {
    return '<button class="btn-icono' + (peligro ? ' btn-icono--peligro' : '') + '" data-accion="' + accion + '" data-id="' + id + '" aria-label="' + escapar(etiqueta) + '" title="' + escapar(etiqueta) + '">' + icono(icon) + '</button>';
  }
  function toggle(accion, id, activo, etiqueta) {
    return '<label class="toggle"><input type="checkbox" data-accion="' + accion + '" data-id="' + id + '"' + (activo ? ' checked' : '') +
      ' aria-label="' + escapar(etiqueta) + '"><span class="toggle__pista"></span></label>';
  }
  function badge(tipo, texto) { return '<span class="badge badge--' + tipo + '">' + escapar(texto) + '</span>'; }
  let tt;
  function toast(msg, error) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(tt);
    tt = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function errorGenerico(e) {
    if (e.codigo === 'NO_AUTORIZADO') { toast('Tu sesión expiró. Ingresa de nuevo.', true); salir(); return; }
    toast(e.message || 'Ocurrió un error. Inténtalo de nuevo.', true);
  }
  function tabla(columnas, filas, vacio) {
    if (!filas.length) return '<p class="vacio" style="margin:20px">' + vacio + '</p>';
    return '<table><thead><tr>' + columnas.map(c => '<th scope="col">' + c + '</th>').join('') + '</tr></thead><tbody>' +
      filas.join('') + '</tbody></table>';
  }
  function abrirModal(id, foco) { $(id).hidden = false; document.body.style.overflow = 'hidden'; if (foco) $(foco).focus(); }
  function cerrarModales() { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); document.body.style.overflow = ''; }
  function errorCampo(id, msg) {
    const e = $('#e-' + id);
    if (msg) { e.textContent = msg; e.hidden = false; $('#' + id).setAttribute('aria-invalid', 'true'); }
    else { e.hidden = true; $('#' + id).removeAttribute('aria-invalid'); }
  }

  // Reglas de cada campo de los formularios (ver js/validacion.js)
  const REGLAS_MESA = {
    'm-nombre': () => sinRepetir(V.nombreCosa($('#m-nombre').value, 40, 'de la mesa'), estado.mesas, estado.editandoMesa, 'Ya existe una mesa con ese nombre.'),
    'm-capacidad': () => V.entero($('#m-capacidad').value, 1, 30, {
      vacio: 'Escribe la capacidad de la mesa.', rango: 'La capacidad debe estar entre 1 y 30 personas.' }),
    'm-foto': () => V.urlFoto($('#m-foto').value)
  };
  const REGLAS_PLATO = {
    'p-nombre': () => sinRepetir(V.nombreCosa($('#p-nombre').value, 80, 'del plato'), estado.platos, estado.editandoPlato, 'Ya existe un plato con ese nombre.'),
    'p-descripcion': () => V.texto($('#p-descripcion').value, 160, 'La descripción'),
    'p-precio': () => V.entero($('#p-precio').value, 100, 1000000, {
      vacio: 'Escribe el precio en pesos.', rango: 'El precio debe estar entre $100 y $1.000.000.' })
  };
  const CAMPOS_MESA = Object.keys(REGLAS_MESA);
  const CAMPOS_PLATO = Object.keys(REGLAS_PLATO);

  /** Revisa todos los campos de un formulario; si alguno falla muestra su error y devuelve null */
  function validarCampos(reglas) {
    const valores = {};
    let primero = null;
    Object.keys(reglas).forEach(id => {
      const r = reglas[id]();
      errorCampo(id, r.error);
      if (r.error && !primero) primero = id;
      valores[id] = r.valor;
    });
    if (primero) { $('#' + primero).focus(); return null; }
    Object.keys(valores).forEach(id => { $('#' + id).value = valores[id] == null ? '' : valores[id]; });
    return valores;
  }
  /** Los nombres de mesas y platos no se repiten (sin importar mayúsculas), igual que en la base de datos */
  function sinRepetir(r, lista, propio, mensaje) {
    if (r.error) return r;
    const n = r.valor.toLowerCase();
    if (lista.some(x => (!propio || x.id !== propio.id) && String(x.nombre).trim().toLowerCase() === n)) r.error = mensaje;
    return r;
  }

  // ---------------------------------------------------------------------------
  // RF-08: acceso con contraseña
  // ---------------------------------------------------------------------------
  async function ingresar(ev) {
    ev.preventDefault();
    const clave = $('#clave').value;
    // La clave viaja en un encabezado HTTP, que no admite tildes ni ñ
    const rc = V.clave(clave);
    errorCampo('clave', rc.error);
    if (rc.error) { $('#clave').focus(); return; }
    const btn = $('#btn-ingresar');
    btn.disabled = true;
    try {
      const ok = await D.verificarAdmin(clave);
      if (!ok) {
        K.cerrarSesionAdmin();
        errorCampo('clave', 'Contraseña incorrecta. Inténtalo de nuevo.');
        $('#clave').select();
        return;
      }
      mostrarPanel();
    } catch (e) {
      K.cerrarSesionAdmin();
      errorCampo('clave', e.message || 'No pudimos verificar la contraseña.');
    } finally {
      btn.disabled = false;
    }
  }

  function salir() {
    K.cerrarSesionAdmin();
    $('#panel').hidden = true;
    $('#acceso').hidden = false;
    $('#clave').value = '';
    $('#clave').focus();
  }

  async function mostrarPanel() {
    $('#acceso').hidden = true;
    $('#panel').hidden = false;
    try {
      const r = await Promise.all([D.listarMesas(), D.listarHorarios(), D.listarPlatos()]);
      estado.mesas = r[0]; estado.horarios = r[1]; estado.platos = r[2];
    } catch (e) { errorGenerico(e); }
    llenarSelectMesas();
    navegar();
  }

  // Navegación por secciones con el hash de la URL (#mesas, #horarios, #reservas, #carta)
  function navegar() {
    if ($('#panel').hidden) return;
    let s = location.hash.replace('#', '');
    if (['mesas', 'horarios', 'reservas', 'carta'].indexOf(s) < 0) s = 'reservas';
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== s; });
    document.querySelectorAll('[data-seccion]').forEach(a => {
      if (a.dataset.seccion === s) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    ({ mesas: renderMesas, horarios: renderHorarios, reservas: cargarReservas, carta: renderPlatos })[s]();
  }

  // ---------------------------------------------------------------------------
  // RF-09, RF-10, RF-13: mesas
  // ---------------------------------------------------------------------------
  async function recargarMesas() {
    estado.mesas = await D.listarMesas();
    llenarSelectMesas();
    renderMesas();
  }

  function renderMesas() {
    const lista = estado.mesas.filter(m => !estado.zonaMesas || m.zona === estado.zonaMesas);
    const activas = estado.mesas.filter(m => m.activa).length;
    $('#conteo-mesas').textContent = estado.mesas.length + ' mesas · ' + activas + ' activas';
    $('#tabla-mesas').innerHTML = tabla(['Mesa', 'Zona', 'Capacidad', 'Estado', 'Acciones'], lista.map(m =>
      '<tr><td><strong>' + escapar(m.nombre) + '</strong></td>' +
      '<td>' + U.ZONAS[m.zona] + '</td>' +
      '<td>' + m.capacidad + ' personas</td>' +
      '<td><span style="display:inline-flex;gap:8px;align-items:center">' + toggle('estado-mesa', m.id, m.activa, 'Mesa activa: ' + m.nombre) +
        badge(m.activa ? 'activa' : 'inactiva', m.activa ? 'Activa' : 'Inactiva') + '</span></td>' +
      '<td class="acciones">' + btnIcono('editar-mesa', 'editar', 'Editar ' + m.nombre, m.id) + btnIcono('borrar-mesa', 'borrar', 'Borrar ' + m.nombre, m.id, true) + '</td></tr>'
    ), 'No hay mesas registradas en esta zona.');
  }

  function abrirMesa(mesa) {
    estado.editandoMesa = mesa || null;
    $('#mm-titulo').textContent = mesa ? 'Editar ' + mesa.nombre : 'Nueva mesa';
    $('#m-nombre').value = mesa ? mesa.nombre : '';
    $('#m-zona').value = mesa ? mesa.zona : 'terraza';
    $('#m-capacidad').value = mesa ? mesa.capacidad : 4;
    $('#m-foto').value = mesa && mesa.foto_url ? mesa.foto_url : '';
    $('#m-activa').checked = mesa ? mesa.activa : true;
    CAMPOS_MESA.forEach(c => errorCampo(c, ''));
    abrirModal('#modal-mesa', '#m-nombre');
  }

  async function guardarMesa(ev) {
    ev.preventDefault();
    const r = validarCampos(REGLAS_MESA);
    if (!r) return;
    const datos = { nombre: r['m-nombre'], zona: $('#m-zona').value, capacidad: r['m-capacidad'], foto_url: r['m-foto'], activa: $('#m-activa').checked };
    try {
      if (estado.editandoMesa) await D.actualizarMesa(estado.editandoMesa.id, datos);
      else await D.crearMesa(datos);
      cerrarModales();
      toast(estado.editandoMesa ? 'Mesa actualizada.' : 'Mesa registrada. Ya puede recibir reservas.');
      await recargarMesas();
    } catch (e) {
      if (e.codigo === 'DUPLICADO') errorCampo('m-nombre', 'Ya existe una mesa con ese nombre.');
      else errorGenerico(e);
    }
  }

  async function cambiarEstadoMesa(id, activa) {
    try {
      await D.actualizarMesa(id, { activa: activa });
      const m = estado.mesas.find(x => x.id === id);
      if (m) m.activa = activa;
      renderMesas();
      toast(activa ? 'Mesa activada: ya aparece para los clientes.' : 'Mesa desactivada: ya no aparece para los clientes.');
    } catch (e) { errorGenerico(e); renderMesas(); }
  }

  async function borrarMesa(id) {
    const m = estado.mesas.find(x => x.id === id);
    if (!m || !confirm('¿Borrar ' + m.nombre + '? Esta acción no se puede deshacer.')) return;
    try {
      await D.borrarMesa(id);
      toast('Mesa eliminada.');
      await recargarMesas();
    } catch (e) {
      if (e.codigo === 'TIENE_RESERVAS') toast('Esta mesa tiene reservas registradas. Desactívala en lugar de borrarla.', true);
      else errorGenerico(e);
    }
  }

  // ---------------------------------------------------------------------------
  // RF-11: horarios
  // ---------------------------------------------------------------------------
  const ORDEN_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  function renderHorarios() {
    const lista = estado.horarios.slice().sort((a, b) =>
      ORDEN_DIAS.indexOf(a.dia_semana) - ORDEN_DIAS.indexOf(b.dia_semana) || U.aMinutos(a.hora_inicio) - U.aMinutos(b.hora_inicio));
    const hhmm = h => h.slice(0, 5);
    $('#tabla-horarios').innerHTML = tabla(['Día', 'Jornada', 'Inicio', 'Fin', 'Duración (min)', 'Activo', 'Acciones'], lista.map(h => {
      const c = estado.horariosCambiados[h.id] || {};
      const v = Object.assign({}, h, c);
      return '<tr data-horario="' + h.id + '"' + (estado.horariosCambiados[h.id] ? ' class="fila-cambiada"' : '') + '>' +
        '<td><strong>' + U.DIAS_LEGIBLES[h.dia_semana] + '</strong></td>' +
        '<td>' + U.JORNADAS[h.jornada] + '</td>' +
        '<td><input type="time" data-campo="hora_inicio" value="' + hhmm(v.hora_inicio) + '" aria-label="Hora de inicio ' + U.DIAS_LEGIBLES[h.dia_semana] + ' ' + h.jornada + '"></td>' +
        '<td><input type="time" data-campo="hora_fin" value="' + hhmm(v.hora_fin) + '" aria-label="Hora de fin ' + U.DIAS_LEGIBLES[h.dia_semana] + ' ' + h.jornada + '"></td>' +
        '<td><input type="text" inputmode="numeric" maxlength="3" autocomplete="off" data-campo="duracion_slot" value="' + escapar(v.duracion_slot) + '" aria-label="Duración en minutos, ' + U.DIAS_LEGIBLES[h.dia_semana] + ' ' + h.jornada + '"></td>' +
        '<td>' + toggle('horario-activo', h.id, v.activo, 'Jornada activa') + '</td>' +
        '<td class="acciones">' + btnIcono('borrar-horario', 'borrar', 'Borrar jornada', h.id, true) + '</td></tr>';
    }), 'No hay horarios definidos. Agrega una jornada abajo.');
    $('#btn-guardar-horarios').disabled = !Object.keys(estado.horariosCambiados).length;
    document.querySelectorAll('#tabla-horarios input[data-campo="duracion_slot"]').forEach(i => V.filtrar(i, 'digitos', m => toast(m, true)));
  }

  function marcarHorario(id, campo, valor) {
    estado.horariosCambiados[id] = Object.assign(estado.horariosCambiados[id] || {}, { [campo]: valor });
    const fila = document.querySelector('[data-horario="' + id + '"]');
    if (fila) fila.classList.add('fila-cambiada');
    $('#btn-guardar-horarios').disabled = false;
  }

  async function guardarHorarios() {
    const ids = Object.keys(estado.horariosCambiados);
    for (const id of ids) {
      const v = Object.assign({}, estado.horarios.find(h => h.id === id), estado.horariosCambiados[id]);
      const err = V.registro.horario(v, false);
      if (err) {
        toast(U.DIAS_LEGIBLES[v.dia_semana] + ' (' + v.jornada + '): ' + err, true);
        const f = document.querySelector('[data-horario="' + id + '"] input');
        if (f) f.focus();
        return;
      }
    }
    try {
      await Promise.all(ids.map(id => D.actualizarHorario(id, estado.horariosCambiados[id])));
      estado.horariosCambiados = {};
      estado.horarios = await D.listarHorarios();
      renderHorarios();
      toast('Horarios guardados. Los clientes ya ven los nuevos horarios.');
    } catch (e) { errorGenerico(e); }
  }

  function aplicarDuracion() {
    const min = Number($('#duracion-global').value);
    estado.horarios.forEach(h => { if (h.duracion_slot !== min) marcarHorario(h.id, 'duracion_slot', min); });
    renderHorarios();
  }

  async function agregarHorario(ev) {
    ev.preventDefault();
    const h = {
      dia_semana: $('#h-dia').value, jornada: $('#h-jornada').value,
      hora_inicio: $('#h-inicio').value, hora_fin: $('#h-fin').value,
      duracion_slot: Number($('#duracion-global').value), activo: true
    };
    const err = V.registro.horario(h, false);
    if (err) { toast(err, true); return; }
    if (estado.horarios.some(x => x.dia_semana === h.dia_semana && x.jornada === h.jornada)) {
      toast('Ese día ya tiene una jornada de ' + h.jornada + '. Edítala en la tabla.', true); return;
    }
    try {
      await D.crearHorario(h);
      estado.horarios = await D.listarHorarios();
      renderHorarios();
      toast('Jornada agregada.');
    } catch (e) { errorGenerico(e); }
  }

  async function borrarHorario(id) {
    const h = estado.horarios.find(x => x.id === id);
    if (!h || !confirm('¿Borrar la jornada de ' + h.jornada + ' del ' + U.DIAS_LEGIBLES[h.dia_semana].toLowerCase() + '?')) return;
    try {
      await D.borrarHorario(id);
      delete estado.horariosCambiados[id];
      estado.horarios = await D.listarHorarios();
      renderHorarios();
      toast('Jornada eliminada.');
    } catch (e) { errorGenerico(e); }
  }

  // ---------------------------------------------------------------------------
  // RF-12: reservas
  // ---------------------------------------------------------------------------
  function llenarSelectMesas() {
    const sel = $('#f-mesa');
    const actual = sel.value;
    sel.innerHTML = '<option value="">Todas las mesas</option>' +
      estado.mesas.map(m => '<option value="' + m.id + '">' + escapar(m.nombre) + '</option>').join('');
    sel.value = actual;
  }

  async function cargarReservas(ev) {
    if (ev) ev.preventDefault();
    const cont = $('#tabla-reservas');
    cont.innerHTML = '<p class="cargando" style="padding:20px">Cargando reservas…</p>';
    try {
      const lista = await D.listarReservas({ fecha: $('#f-fecha').value, mesaId: $('#f-mesa').value, estado: $('#f-estado').value });
      cont.innerHTML = tabla(['Cliente', 'Mesa', 'Fecha', 'Hora', 'Personas', 'Estado'], lista.map(r =>
        '<tr><td><strong>' + escapar(r.cliente_nombre) + '</strong><span class="sub">' + escapar(r.cliente_contacto || 'Sin contacto') + '</span></td>' +
        '<td>' + escapar(r.mesa ? r.mesa.nombre : '—') + '</td>' +
        '<td>' + U.fechaCorta(r.fecha) + '</td>' +
        '<td>' + r.hora_inicio.slice(0, 5) + ' – ' + r.hora_fin.slice(0, 5) + '</td>' +
        '<td>' + r.num_personas + '</td>' +
        '<td><span style="display:inline-flex;gap:8px;align-items:center">' + badge(r.estado, U.ESTADOS[r.estado]) +
          '<select class="mini" data-accion="estado-reserva" data-id="' + r.id + '" aria-label="Cambiar estado de la reserva de ' + escapar(r.cliente_nombre) + '">' +
          Object.keys(U.ESTADOS).map(e => '<option value="' + e + '"' + (e === r.estado ? ' selected' : '') + '>' + U.ESTADOS[e] + '</option>').join('') +
          '</select></span></td></tr>'
      ), 'No hay reservas con estos filtros.');
      const personas = lista.filter(r => r.estado !== 'cancelada').reduce((s, r) => s + r.num_personas, 0);
      $('#conteo-reservas').textContent = lista.length ? 'Mostrando ' + lista.length + ' reservas · ' + personas + ' personas (sin contar canceladas)' : '';
    } catch (e) {
      cont.innerHTML = '';
      errorGenerico(e);
    }
  }

  async function cambiarEstadoReserva(id, nuevo) {
    try {
      await D.actualizarReserva(id, { estado: nuevo });
      toast('Reserva marcada como ' + U.ESTADOS[nuevo].toLowerCase() + '.');
      cargarReservas();
    } catch (e) {
      if (e.codigo === 'SLOT_OCUPADO') toast('Ese horario ya tiene otra reserva activa: no se puede reactivar.', true);
      else errorGenerico(e);
      cargarReservas();
    }
  }

  // ---------------------------------------------------------------------------
  // RF-14: carta
  // ---------------------------------------------------------------------------
  async function recargarPlatos() { estado.platos = await D.listarPlatos(); renderPlatos(); }

  function renderPlatos() {
    const lista = estado.platos.filter(p => !estado.categoriaPlatos || p.categoria === estado.categoriaPlatos);
    $('#tabla-platos').innerHTML = tabla(['Plato', 'Categoría', 'Precio', 'Visible', 'Acciones'], lista.map(p =>
      '<tr><td><strong>' + escapar(p.nombre) + '</strong><span class="sub">' + escapar(p.descripcion || '') + '</span></td>' +
      '<td>' + U.CATEGORIAS[p.categoria] + '</td>' +
      '<td>' + U.precioCOP(p.precio) + '</td>' +
      '<td><span style="display:inline-flex;gap:8px;align-items:center">' + toggle('disponible-plato', p.id, p.disponible, 'Visible: ' + p.nombre) +
        '<span class="' + (p.disponible ? '' : 'texto-secundario') + '">' + (p.disponible ? 'Visible' : 'Oculto') + '</span></span></td>' +
      '<td class="acciones">' + btnIcono('editar-plato', 'editar', 'Editar ' + p.nombre, p.id) + btnIcono('borrar-plato', 'borrar', 'Borrar ' + p.nombre, p.id, true) + '</td></tr>'
    ), 'No hay platos en esta categoría.');
  }

  function abrirPlato(p) {
    estado.editandoPlato = p || null;
    $('#mp-titulo').textContent = p ? 'Editar plato' : 'Nuevo plato';
    $('#p-nombre').value = p ? p.nombre : '';
    $('#p-categoria').value = p ? p.categoria : (estado.categoriaPlatos || 'pizzas');
    $('#p-descripcion').value = p ? (p.descripcion || '') : '';
    $('#p-precio').value = p ? p.precio : '';
    $('#p-disponible').checked = p ? p.disponible : true;
    CAMPOS_PLATO.forEach(c => errorCampo(c, ''));
    abrirModal('#modal-plato', '#p-nombre');
  }

  async function guardarPlato(ev) {
    ev.preventDefault();
    const r = validarCampos(REGLAS_PLATO);
    if (!r) return;
    const datos = { nombre: r['p-nombre'], categoria: $('#p-categoria').value, descripcion: r['p-descripcion'], precio: r['p-precio'], disponible: $('#p-disponible').checked };
    try {
      if (estado.editandoPlato) await D.actualizarPlato(estado.editandoPlato.id, datos);
      else await D.crearPlato(datos);
      cerrarModales();
      toast(estado.editandoPlato ? 'Plato actualizado.' : 'Plato agregado a la carta.');
      await recargarPlatos();
    } catch (e) {
      if (e.codigo === 'DUPLICADO') errorCampo('p-nombre', 'Ya existe un plato con ese nombre.');
      else errorGenerico(e);
    }
  }

  async function cambiarDisponible(id, disponible) {
    try {
      await D.actualizarPlato(id, { disponible: disponible });
      const p = estado.platos.find(x => x.id === id);
      if (p) p.disponible = disponible;
      renderPlatos();
      toast(disponible ? 'El plato ya se muestra en la carta.' : 'Plato oculto de la carta.');
    } catch (e) { errorGenerico(e); renderPlatos(); }
  }

  async function borrarPlato(id) {
    const p = estado.platos.find(x => x.id === id);
    if (!p || !confirm('¿Borrar "' + p.nombre + '" de la carta? Si solo quieres quitarlo por un tiempo, ocúltalo.')) return;
    try { await D.borrarPlato(id); toast('Plato eliminado.'); await recargarPlatos(); } catch (e) { errorGenerico(e); }
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  $('#form-acceso').addEventListener('submit', ingresar);
  document.querySelectorAll('[data-salir]').forEach(b => b.addEventListener('click', salir));
  window.addEventListener('hashchange', navegar);

  $('#btn-nueva-mesa').addEventListener('click', () => abrirMesa(null));
  $('#form-mesa').addEventListener('submit', guardarMesa);
  $('#btn-nuevo-plato').addEventListener('click', () => abrirPlato(null));
  $('#form-plato').addEventListener('submit', guardarPlato);
  document.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrarModales));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) cerrarModales(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModales(); });

  // Bloquea al escribir o pegar lo que no corresponde a cada campo, quita el error al corregir y revisa al salir
  [[REGLAS_MESA, { 'm-nombre': 'nombreCosa', 'm-capacidad': 'digitos' }],
   [REGLAS_PLATO, { 'p-nombre': 'nombreCosa', 'p-descripcion': 'texto', 'p-precio': 'digitos' }]].forEach(([reglas, filtros]) => {
    Object.keys(reglas).forEach(id => {
      const i = $('#' + id);
      i.addEventListener('input', () => errorCampo(id, ''));
      i.addEventListener('blur', () => { if (i.value.trim()) errorCampo(id, reglas[id]().error); });
      if (filtros[id]) V.filtrar(i, filtros[id], m => errorCampo(id, m));
    });
  });
  $('#clave').addEventListener('input', () => errorCampo('clave', ''));

  $('#filtro-mesas').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    estado.zonaMesas = b.dataset.zona;
    document.querySelectorAll('#filtro-mesas .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderMesas();
  });
  $('#filtro-platos').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    estado.categoriaPlatos = b.dataset.categoria;
    document.querySelectorAll('#filtro-platos .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderPlatos();
  });

  $('#form-filtros').addEventListener('submit', cargarReservas);
  $('#btn-limpiar').addEventListener('click', () => { $('#form-filtros').reset(); cargarReservas(); });

  $('#btn-guardar-horarios').addEventListener('click', guardarHorarios);
  $('#btn-aplicar-duracion').addEventListener('click', aplicarDuracion);
  $('#form-horario').addEventListener('submit', agregarHorario);
  $('#tabla-horarios').addEventListener('change', e => {
    const fila = e.target.closest('[data-horario]');
    if (!fila || !e.target.dataset.campo) return;
    const t = e.target.value.trim();
    // La duración se guarda como número; si no es un entero válido se deja el texto para que la validación lo rechace
    const valor = e.target.dataset.campo === 'duracion_slot' && /^[0-9]+$/.test(t) ? Number(t) : t;
    marcarHorario(fila.dataset.horario, e.target.dataset.campo, valor);
  });

  // Acciones de las tablas (delegación de eventos)
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-accion]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.accion) {
      case 'editar-mesa': abrirMesa(estado.mesas.find(m => m.id === id)); break;
      case 'borrar-mesa': borrarMesa(id); break;
      case 'editar-plato': abrirPlato(estado.platos.find(p => p.id === id)); break;
      case 'borrar-plato': borrarPlato(id); break;
      case 'borrar-horario': borrarHorario(id); break;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || !t.dataset.accion) return;
    switch (t.dataset.accion) {
      case 'estado-mesa': cambiarEstadoMesa(t.dataset.id, t.checked); break;
      case 'disponible-plato': cambiarDisponible(t.dataset.id, t.checked); break;
      case 'horario-activo': marcarHorario(t.dataset.id, 'activo', t.checked); break;
      case 'estado-reserva': cambiarEstadoReserva(t.dataset.id, t.value); break;
    }
  });

  // Inicio
  if (K.modo === 'demo') $('#banner-demo').hidden = false;
  if (K.haySesionAdmin()) {
    D.verificarAdmin(K.claveSesionAdmin())
      .then(ok => { if (ok) mostrarPanel(); else { K.cerrarSesionAdmin(); $('#clave').focus(); } })
      .catch(() => K.cerrarSesionAdmin());
  } else {
    $('#clave').focus();
  }
})();
