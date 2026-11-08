// =============================================================================
// Konys Pizza · Reglas de validación de todos los campos
// Las usan la interfaz (al escribir y al enviar) y la capa de datos (antes de
// guardar). Las mismas reglas están en la base de datos: supabase/validaciones.sql
// =============================================================================
(function () {
  'use strict';

  // Letras del español y otros nombres latinos (á, é, ñ, ü, ç, à…). Mismo rango que en la base de datos.
  const LETRA = 'A-Za-zÀ-ÖØ-öø-ÿ';
  const RE = {
    nombrePersona: new RegExp('^[' + LETRA + '][' + LETRA + " '.-]*$"),
    nombreCosa: new RegExp('^[' + LETRA + '0-9][' + LETRA + "0-9 .,'()&/#+-]*$"),
    letras: new RegExp('[' + LETRA + ']', 'g'),
    entero: /^[0-9]+$/,
    hora: /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/,
    fecha: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    prohibidos: /[<>{}\\\u0000-\u001F\u007F]/
  };

  // Caracteres que se pueden escribir en cada tipo de campo. Lo demás se bloquea al teclear o pegar.
  const PERMITIDOS = {
    digitos: /[0-9]/,
    telefono: /[0-9 +()-]/,
    nombrePersona: new RegExp('[' + LETRA + " '.-]"),
    nombreCosa: new RegExp('[' + LETRA + "0-9 .,'()&/#+-]"),
    texto: /[^<>{}\\]/
  };
  const AVISO_FILTRO = {
    digitos: 'Solo se permiten números (sin letras, puntos, comas ni signos).',
    telefono: 'Solo se permiten números, espacios y los signos + ( ) -',
    nombrePersona: "Solo se permiten letras, espacios y los signos ' . -",
    nombreCosa: "Solo se permiten letras, números, espacios y los signos . , ' ( ) & / # + -",
    texto: 'No se permiten los caracteres < > { } \\'
  };

  const res = (valor, error) => ({ valor: valor, error: error || '' });
  const limpiar = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  const contarLetras = t => (t.match(RE.letras) || []).length;

  // ---------------------------------------------------------------------------
  // Validadores de un campo. Devuelven { valor (normalizado), error ('' si está bien) }
  // ---------------------------------------------------------------------------

  /** Nombre de una persona: solo letras, espacios y ' . - (2 a 80 caracteres) */
  function nombrePersona(t) {
    const v = limpiar(t);
    if (!v) return res(v, 'Escribe tu nombre para la reserva.');
    if (v.length > 80) return res(v, 'El nombre puede tener máximo 80 caracteres.');
    if (/[0-9]/.test(v)) return res(v, 'El nombre no puede tener números.');
    if (!RE.nombrePersona.test(v)) return res(v, "El nombre solo puede tener letras, espacios y los signos ' . -");
    if (contarLetras(v) < 2) return res(v, 'El nombre debe tener al menos 2 letras.');
    if (/['.-]{2,}/.test(v)) return res(v, 'Revisa el nombre: tiene signos repetidos.');
    return res(v);
  }

  /** Teléfono de Colombia: celular (3xx) o fijo (60x), 10 dígitos, con o sin +57. Se guarda como "300 123 4567". */
  function telefono(t, opcional) {
    const v = limpiar(t);
    if (!v) return opcional ? res(null) : res(null, 'Escribe un número de teléfono.');
    if (/[A-Za-zÀ-ÿ@]/.test(v)) return res(v, 'El teléfono no puede tener letras ni @. Escribe solo el número.');
    if (!/^[0-9 +()-]+$/.test(v)) return res(v, 'El teléfono solo puede tener números, espacios y los signos + ( ) -');
    if (v.lastIndexOf('+') > 0) return res(v, 'El signo + solo puede ir al inicio (+57).');
    let dig = v.replace(/[^0-9]/g, '');
    if (v[0] === '+' || dig.length === 12) {
      if (dig.length !== 12 || dig.indexOf('57') !== 0) return res(v, 'Solo se aceptan números de Colombia (+57 y 10 dígitos).');
      dig = dig.slice(2);
    }
    if (dig.length !== 10) return res(v, 'El teléfono debe tener 10 dígitos. Ej: 300 123 4567 o 607 687 9020.');
    if (!/^(3|60)/.test(dig)) return res(v, 'Debe ser un celular (empieza por 3) o un fijo (empieza por 60).');
    if (/^(\d)\1+$/.test(dig.slice(1))) return res(v, 'Ese número no parece real. Revísalo.');
    return res(dig.slice(0, 3) + ' ' + dig.slice(3, 6) + ' ' + dig.slice(6));
  }

  /**
   * Número entero sin letras, puntos, comas, signos ni notación científica (1e1, 2.5, -3, +4 se rechazan).
   * mensajes: { vacio, rango } para personalizar el texto.
   */
  function entero(t, min, max, mensajes) {
    mensajes = mensajes || {};
    const v = typeof t === 'number' ? String(t) : String(t == null ? '' : t).trim();
    if (!v) return res(null, mensajes.vacio || 'Este campo es obligatorio.');
    if (!RE.entero.test(v)) return res(null, mensajes.formato || 'Escribe solo números enteros, sin letras, puntos, comas ni signos.');
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < min || n > max) return res(n, mensajes.rango || ('Debe ser un número entre ' + min + ' y ' + max + '.'));
    return res(n);
  }

  /** Nombre de una mesa o de un plato: letras, números y signos básicos */
  function nombreCosa(t, max, que) {
    const v = limpiar(t);
    if (!v) return res(v, 'Escribe el nombre ' + que + '.');
    if (v.length < 2) return res(v, 'El nombre ' + que + ' debe tener al menos 2 caracteres.');
    if (v.length > max) return res(v, 'El nombre ' + que + ' puede tener máximo ' + max + ' caracteres.');
    if (!RE.nombreCosa.test(v)) return res(v, "Usa solo letras, números, espacios y los signos . , ' ( ) & / # + -");
    if (!/[0-9]/.test(v) && contarLetras(v) < 2) return res(v, 'El nombre ' + que + ' debe tener al menos 2 letras.');
    return res(v);
  }

  /** Texto libre opcional (descripción): sin < > { } \ ni caracteres de control */
  function texto(t, max, que) {
    const v = limpiar(t);
    if (!v) return res(null);
    if (v.length > max) return res(v, que + ' puede tener máximo ' + max + ' caracteres.');
    if (RE.prohibidos.test(v)) return res(v, que + ' no puede tener los caracteres < > { } \\');
    if (contarLetras(v) < 3) return res(v, que + ' debe tener al menos 3 letras.');
    return res(v);
  }

  /** URL opcional de una foto: debe ser https:// y una dirección válida */
  function urlFoto(t) {
    const v = String(t == null ? '' : t).trim();
    if (!v) return res(null);
    if (v.length > 300) return res(v, 'La URL es demasiado larga (máximo 300 caracteres).');
    if (/[\s"'`<>\\]/.test(v)) return res(v, 'La URL no puede tener espacios, comillas ni < > \\');
    let u;
    try { u = new URL(v); } catch (e) { return res(v, 'Escribe una URL completa. Ej: https://sitio.com/foto.jpg'); }
    if (u.protocol !== 'https:') return res(v, 'La URL debe empezar por https://');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return res(v, 'La dirección del sitio no es válida.');
    return res(v);
  }

  /** Hora 'HH:MM' (24 horas) */
  function hora(t, que) {
    const v = String(t == null ? '' : t).trim();
    if (!v) return res(null, 'Escribe la hora de ' + que + '.');
    if (!RE.hora.test(v)) return res(null, 'La hora de ' + que + ' no es válida (formato HH:MM).');
    return res(v.slice(0, 5));
  }

  /** Fecha 'AAAA-MM-DD' que exista en el calendario */
  function fecha(t) {
    const v = String(t == null ? '' : t).trim();
    if (!RE.fecha.test(v)) return res(null, 'La fecha no es válida.');
    const p = v.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) return res(null, 'Esa fecha no existe.');
    return res(v);
  }

  /** Contraseña del admin: viaja en un encabezado HTTP, que no admite tildes ni ñ */
  function clave(t) {
    const v = String(t == null ? '' : t);
    if (!v) return res(v, 'Escribe la contraseña.');
    if (/[^\x20-\x7E]/.test(v)) return res(v, 'La contraseña no puede tener tildes ni ñ.');
    if (v.length > 72) return res(v, 'La contraseña puede tener máximo 72 caracteres.');
    return res(v);
  }

  // ---------------------------------------------------------------------------
  // Validación de registros completos (la capa de datos la usa antes de guardar).
  // Con parcial = true solo se revisan los campos que vienen (actualizaciones).
  // Devuelve el primer error encontrado o ''.
  // ---------------------------------------------------------------------------
  const ZONAS = ['terraza', 'salon'];
  const CATEGORIAS = ['pizzas', 'entradas', 'postres', 'bebidas'];
  const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const JORNADAS = ['almuerzo', 'noche'];
  const ESTADOS = ['confirmada', 'cancelada', 'completada'];

  function revisar(x, parcial, reglas) {
    for (const campo of Object.keys(reglas)) {
      if (parcial && !(campo in x)) continue;
      const err = reglas[campo](x[campo]);
      if (err) return err;
    }
    return '';
  }
  // En la capa de datos los números deben llegar como número, no como texto ("5") ni decimal (2.5)
  const numero = (que, min, max, extra) => v => {
    if (typeof v !== 'number') return que + ' debe ser un número entero.';
    const r = entero(v, min, max, { rango: que + ' debe estar entre ' + min + ' y ' + max + '.' });
    return r.error || (extra ? extra(v) : '');
  };
  const enLista = (lista, msg) => v => (lista.indexOf(v) >= 0 ? '' : msg);
  const booleano = msg => v => (typeof v === 'boolean' ? '' : msg);

  const registro = {
    reserva(x, parcial) {
      const err = revisar(x, parcial, {
        mesa_id: v => (RE.uuid.test(String(v || '')) ? '' : 'La mesa no es válida.'),
        cliente_nombre: v => (typeof v === 'string' ? nombrePersona(v).error : 'El nombre no es válido.'),
        cliente_contacto: v => {
          if (v == null) return '';
          const t = telefono(v, true);
          return t.error || (t.valor !== v ? 'El teléfono debe guardarse como 300 123 4567.' : '');
        },
        num_personas: numero('El número de personas', 1, 30),
        fecha: v => fecha(v).error,
        hora_inicio: v => hora(v, 'inicio').error,
        hora_fin: v => hora(v, 'fin').error,
        estado: v => (v == null && !parcial ? '' : enLista(ESTADOS, 'El estado no es válido.')(v))
      });
      if (err) return err;
      if (x.hora_inicio && x.hora_fin && x.hora_fin.slice(0, 5) <= x.hora_inicio.slice(0, 5)) return 'La hora de fin debe ser posterior a la de inicio.';
      return '';
    },
    mesa(x, parcial) {
      return revisar(x, parcial, {
        nombre: v => nombreCosa(v, 40, 'de la mesa').error,
        zona: enLista(ZONAS, 'La zona no es válida.'),
        capacidad: numero('La capacidad', 1, 30),
        foto_url: v => (v == null ? '' : urlFoto(v).error),
        activa: booleano('El estado de la mesa no es válido.')
      });
    },
    plato(x, parcial) {
      return revisar(x, parcial, {
        nombre: v => nombreCosa(v, 80, 'del plato').error,
        categoria: enLista(CATEGORIAS, 'La categoría no es válida.'),
        descripcion: v => (v == null ? '' : texto(v, 160, 'La descripción').error),
        precio: numero('El precio', 100, 1000000),
        disponible: booleano('La visibilidad del plato no es válida.')
      });
    },
    horario(x, parcial) {
      const err = revisar(x, parcial, {
        dia_semana: enLista(DIAS, 'El día no es válido.'),
        jornada: enLista(JORNADAS, 'La jornada no es válida.'),
        hora_inicio: v => hora(v, 'inicio').error,
        hora_fin: v => hora(v, 'fin').error,
        duracion_slot: numero('La duración', 15, 240, v => (v % 15 ? 'La duración debe ir de 15 en 15 minutos (15, 30, 45, 60…).' : '')),
        activo: booleano('El estado de la jornada no es válido.')
      });
      if (err) return err;
      if (x.hora_inicio && x.hora_fin) {
        const ini = aMin(x.hora_inicio), fin = aMin(x.hora_fin);
        if (fin <= ini) return 'La hora de fin debe ser posterior a la de inicio.';
        if (x.duracion_slot && fin - ini < x.duracion_slot) return 'La jornada es más corta que la duración de una reserva.';
      }
      return '';
    }
  };
  function aMin(h) { const p = String(h).split(':').map(Number); return p[0] * 60 + p[1]; }

  // ---------------------------------------------------------------------------
  // Filtro al escribir: bloquea los caracteres no permitidos (teclado o pegar) y avisa
  // ---------------------------------------------------------------------------
  function filtrar(input, tipo, avisar) {
    const ok = PERMITIDOS[tipo];
    const limpio = s => Array.from(s).filter(c => ok.test(c)).join('');
    input.addEventListener('beforeinput', e => {
      if (e.data && limpio(e.data) !== e.data && e.cancelable) {
        e.preventDefault();
        if (avisar) avisar(AVISO_FILTRO[tipo]);
      }
    });
    // Respaldo (autocompletar, teclados de celular): limpia lo que se haya colado
    input.addEventListener('input', () => {
      const l = limpio(input.value);
      if (l !== input.value) {
        input.value = l;
        if (avisar) setTimeout(() => avisar(AVISO_FILTRO[tipo]), 0);
      }
    });
  }

  window.KonysValidacion = {
    nombrePersona, telefono, entero, nombreCosa, texto, urlFoto, hora, fecha, clave,
    registro, filtrar, AVISO_FILTRO
  };
})();
