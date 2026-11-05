// Konys Pizza · Sistema de Reservas de Mesas
// Plugin de Figma que genera el sistema de diseño completo:
//   1. Portada
//   2. Sistema de diseño (variables, estilos, componentes con variantes, trazabilidad)
//   3. Mockups de ALTA fidelidad (construidos con instancias de los componentes)
//   4. Mockups de BAJA fidelidad (wireframes en escala de grises, mismas pantallas)

// ---------------------------------------------------------------------------
// Utilidades de color
// ---------------------------------------------------------------------------
function rgb(hex) {
  const s = hex.replace('#', '');
  return { r: parseInt(s.slice(0, 2), 16) / 255, g: parseInt(s.slice(2, 4), 16) / 255, b: parseInt(s.slice(4, 6), 16) / 255 };
}
function rgba(hex, a) { const c = rgb(hex); return { r: c.r, g: c.g, b: c.b, a: a }; }
function luminance(hex) {
  const c = rgb(hex);
  const f = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  const l = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
// Paleta base del documento (§11.3): primario #0F2B3D, acento #F28C28, fondo blanco / gris claro.
const PRIM = {
  'azul/50': '#E7EEF3', 'azul/100': '#C9D7E1', 'azul/300': '#6F8EA5', 'azul/500': '#1F4A66',
  'azul/700': '#0F2B3D', 'azul/800': '#0A1F2C', 'azul/900': '#08161F', 'azul/950': '#050E14',
  'naranja/50': '#FEF3E7', 'naranja/100': '#FCDDBA', 'naranja/400': '#F5A55A', 'naranja/500': '#F28C28',
  'naranja/600': '#D9761A', 'naranja/700': '#A8560C',
  'neutro/0': '#FFFFFF', 'neutro/50': '#F7F8FA', 'neutro/100': '#EEF1F4', 'neutro/200': '#DDE2E7',
  'neutro/300': '#C3CBD3', 'neutro/400': '#7B8794', 'neutro/500': '#6B7785', 'neutro/600': '#55616D',
  'neutro/900': '#14202B',
  'verde/50': '#E5F5EC', 'verde/600': '#2E9E5B', 'verde/700': '#1E7044', 'verde/900': '#0F3D24',
  'rojo/50': '#FCEAEA', 'rojo/600': '#C93C3C', 'rojo/700': '#A82E2E', 'rojo/900': '#4A1414'
};

// [token semántico, primitivo modo claro, primitivo modo oscuro, gris de wireframe, uso]
const SEM = [
  ['fondo/pagina', 'neutro/50', 'azul/950', '#F5F5F5', 'Fondo general de las pantallas'],
  ['fondo/superficie', 'neutro/0', 'azul/900', '#FFFFFF', 'Tarjetas, modales, tablas y campos'],
  ['fondo/sutil', 'neutro/100', 'azul/800', '#EBEBEB', 'Encabezados de tabla, resúmenes, slots ocupados'],
  ['fondo/primario', 'azul/700', 'azul/500', '#4D4D4D', 'Encabezado, hero, menú admin y botón primario'],
  ['fondo/primario-hover', 'azul/800', 'azul/300', '#333333', 'Hover del botón primario'],
  ['fondo/primario-suave', 'azul/50', 'azul/800', '#E0E0E0', 'Placeholders de foto, badge "Completada"'],
  ['fondo/acento', 'naranja/500', 'naranja/500', '#262626', 'Botón de llamada a la acción e ítem activo'],
  ['fondo/acento-hover', 'naranja/600', 'naranja/400', '#111111', 'Hover del botón de acento'],
  ['fondo/acento-suave', 'naranja/50', 'azul/800', '#F0F0F0', 'Hover de slots y fondos de aviso'],
  ['fondo/deshabilitado', 'neutro/100', 'azul/800', '#E6E6E6', 'Botones y campos deshabilitados'],
  ['fondo/overlay', 'azul/950', 'azul/950', '#000000', 'Capa detrás de los modales (60 % de opacidad)'],
  ['texto/principal', 'neutro/900', 'neutro/50', '#222222', 'Texto de lectura y títulos'],
  ['texto/secundario', 'neutro/600', 'neutro/300', '#555555', 'Descripciones y metadatos'],
  ['texto/terciario', 'neutro/500', 'neutro/400', '#8A8A8A', 'Placeholders y textos de ayuda'],
  ['texto/deshabilitado', 'neutro/400', 'neutro/600', '#A6A6A6', 'Texto de elementos deshabilitados'],
  ['texto/invertido', 'neutro/0', 'neutro/0', '#FFFFFF', 'Texto sobre fondos oscuros'],
  ['texto/invertido-suave', 'azul/100', 'azul/100', '#E0E0E0', 'Texto secundario sobre fondos oscuros'],
  ['texto/marca', 'azul/700', 'neutro/0', '#222222', 'Títulos de marca y botones secundarios'],
  ['texto/sobre-acento', 'azul/700', 'azul/950', '#FFFFFF', 'Texto sobre el naranja de acento'],
  ['texto/acento', 'naranja/700', 'naranja/400', '#444444', 'Precios y enlaces sobre fondo claro'],
  ['texto/acento-claro', 'naranja/500', 'naranja/400', '#DDDDDD', 'Acento sobre fondos oscuros'],
  ['borde/default', 'neutro/200', 'azul/500', '#CCCCCC', 'Bordes de tarjetas, tablas y campos'],
  ['borde/fuerte', 'neutro/400', 'azul/300', '#999999', 'Botón secundario, toggles apagados'],
  ['borde/foco', 'naranja/500', 'naranja/400', '#222222', 'Anillo de foco y hover de selección'],
  ['estado/libre', 'verde/600', 'verde/600', '#333333', 'Disponible / activo / confirmado'],
  ['estado/libre-fondo', 'verde/50', 'verde/900', '#FFFFFF', 'Fondo de badges de disponibilidad'],
  ['estado/libre-texto', 'verde/700', 'verde/50', '#333333', 'Texto de badges de disponibilidad'],
  ['estado/error', 'rojo/600', 'rojo/600', '#555555', 'Errores y acciones destructivas'],
  ['estado/error-fondo', 'rojo/50', 'rojo/900', '#EEEEEE', 'Fondo de alertas de error'],
  ['estado/error-texto', 'rojo/700', 'rojo/50', '#333333', 'Texto de errores'],
  ['estado/aviso', 'naranja/500', 'naranja/500', '#777777', 'Avisos'],
  ['estado/aviso-fondo', 'naranja/50', 'azul/800', '#F2F2F2', 'Fondo de avisos'],
  ['estado/aviso-texto', 'naranja/700', 'naranja/400', '#333333', 'Texto de avisos'],
  ['estado/info', 'azul/700', 'azul/300', '#777777', 'Información'],
  ['estado/info-fondo', 'azul/50', 'azul/800', '#F2F2F2', 'Fondo de mensajes informativos'],
  ['estado/info-texto', 'azul/700', 'azul/100', '#333333', 'Texto de mensajes informativos']
];
const SEM_LIGHT_HEX = {};
SEM.forEach(r => { SEM_LIGHT_HEX[r[0]] = PRIM[r[1]]; });

const SPACE_VALUES = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
const RADIUS_VALUES = { sm: 6, md: 10, lg: 16, xl: 24, full: 999 };

// Escala tipográfica (§11.3: sans-serif moderna de Google Fonts → Poppins para títulos, Inter para texto)
const TS = {
  display: { n: 'Display/Escritorio', f: 'hBold', s: 56, lh: 64, ls: -2 },
  displayM: { n: 'Display/Móvil', f: 'hBold', s: 36, lh: 44, ls: -1 },
  h1: { n: 'Título/H1', f: 'hBold', s: 36, lh: 44 },
  h2: { n: 'Título/H2', f: 'hSemi', s: 28, lh: 36 },
  h3: { n: 'Título/H3', f: 'hSemi', s: 20, lh: 28 },
  bodyL: { n: 'Cuerpo/Grande', f: 'reg', s: 18, lh: 28 },
  body: { n: 'Cuerpo/Base', f: 'reg', s: 16, lh: 24 },
  bodyS: { n: 'Cuerpo/Pequeño', f: 'reg', s: 14, lh: 20 },
  labelL: { n: 'Etiqueta/Grande', f: 'semi', s: 16, lh: 24 },
  label: { n: 'Etiqueta/Base', f: 'semi', s: 14, lh: 20 },
  caption: { n: 'Leyenda/Base', f: 'med', s: 12, lh: 16 },
  overline: { n: 'Leyenda/Sobretítulo', f: 'semi', s: 12, lh: 16, ls: 8, upper: true }
};

const ICON_SVG = {
  'calendario': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'reloj': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'personas': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2.1.7 3.5 2.8 3.5 5.8"/>',
  'ubicacion': '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  'telefono': '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  'instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5"/>',
  'check': '<path d="M5 12.5l4.5 4.5L19 7"/>',
  'check-circulo': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  'alerta': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
  'x': '<path d="M6 6l12 12M18 6L6 18"/>',
  'mas': '<path d="M12 5v14M5 12h14"/>',
  'editar': '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  'borrar': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  'ojo': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'ojo-cerrado': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'candado': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  'flecha-izq': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'chevron-izq': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-der': '<path d="M9 6l6 6-6 6"/>',
  'chevron-abajo': '<path d="M6 9l6 6 6-6"/>',
  'mesa': '<rect x="3" y="7" width="18" height="4" rx="1"/><path d="M6 11v9M18 11v9"/>',
  'pizza': '<path d="M12 21L3 6a14 14 0 0 1 18 0z"/><circle cx="10" cy="10" r="1.2"/><circle cx="14" cy="13" r="1.2"/><circle cx="12" cy="16.5" r="1"/>',
  'carta': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21h15M8 7h7M8 11h5"/>',
  'salir': '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  'filtro': '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
  'subir': '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
};
const ICON_LABEL = {
  'calendario': 'Calendario', 'reloj': 'Reloj', 'personas': 'Personas', 'ubicacion': 'Ubicación', 'telefono': 'Teléfono',
  'instagram': 'Instagram', 'check': 'Check', 'check-circulo': 'Check círculo', 'alerta': 'Alerta', 'info': 'Info', 'x': 'Cerrar',
  'mas': 'Más', 'editar': 'Editar', 'borrar': 'Borrar', 'ojo': 'Mostrar', 'ojo-cerrado': 'Ocultar', 'menu': 'Menú',
  'candado': 'Candado', 'flecha-izq': 'Volver', 'chevron-izq': 'Anterior', 'chevron-der': 'Siguiente',
  'chevron-abajo': 'Desplegar', 'mesa': 'Mesa', 'pizza': 'Pizza', 'carta': 'Carta', 'salir': 'Salir', 'filtro': 'Filtro', 'subir': 'Subir'
};
function svgIcon(body, hex) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + hex +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}

// ---------------------------------------------------------------------------
// Datos de ejemplo (coherentes con el modelo de datos §10)
// ---------------------------------------------------------------------------
const MESAS = [
  ['Mesa 1', 'Terraza', 4, 'Libre'], ['Mesa 2', 'Terraza', 2, 'Libre'], ['Mesa 3', 'Salón', 6, 'Libre'],
  ['Mesa 4', 'Salón', 4, 'Ocupada'], ['Mesa 5', 'Salón', 8, 'Libre'], ['Mesa 6', 'Terraza', 4, 'Libre'],
  ['Mesa 7', 'Salón', 2, 'Ocupada'], ['Mesa 8', 'Terraza', 6, 'Libre']
];
// [nombre, categoría, descripción, precio, disponible]
const PLATOS = [
  ['Pizza Konys Especial', 'Pizzas', 'Pepperoni, jamón, champiñones, maíz tierno y queso mozzarella.', '$38.000', true],
  ['Pizza Hawaiana', 'Pizzas', 'Jamón, piña caramelizada y queso mozzarella.', '$32.000', true],
  ['Pizza Pepperoni', 'Pizzas', 'Doble pepperoni, salsa de tomate de la casa y orégano.', '$34.000', true],
  ['Pizza Vegetariana', 'Pizzas', 'Pimentón, cebolla morada, aceitunas, champiñones y tomate.', '$31.000', true],
  ['Pizza Mexicana', 'Pizzas', 'Carne molida, jalapeños, frijol, maíz y nachos.', '$36.000', true],
  ['Pizza Margarita', 'Pizzas', 'Tomate, albahaca fresca y mozzarella.', '$29.000', true],
  ['Pan de ajo', 'Entradas', 'Pan artesanal con mantequilla de ajo y finas hierbas.', '$12.000', true],
  ['Alitas BBQ', 'Entradas', '8 alitas en salsa BBQ con papas a la francesa.', '$24.000', true],
  ['Palitos de queso', 'Entradas', 'Masa de la casa rellena de mozzarella, con salsa napolitana.', '$15.000', true],
  ['Brownie con helado', 'Postres', 'Brownie tibio de chocolate con helado de vainilla.', '$14.000', true],
  ['Postre de tres leches', 'Postres', 'Bizcocho húmedo con crema batida y canela.', '$12.000', false],
  ['Limonada de coco', 'Bebidas', 'Limonada natural con crema de coco.', '$10.000', true],
  ['Jugo natural', 'Bebidas', 'Mango, mora o lulo, en agua o en leche.', '$8.000', true],
  ['Gaseosa 400 ml', 'Bebidas', 'Variedad de sabores.', '$5.000', true]
];
const RESERVAS = [
  ['Juan Pérez', '300 000 0001', 'Mesa 3', '17/10/2026', '19:00', '4', 'Confirmada'],
  ['María Gómez', 'Sin contacto', 'Mesa 1', '17/10/2026', '19:00', '2', 'Confirmada'],
  ['Laura Díaz', '300 000 0003', 'Mesa 4', '17/10/2026', '20:00', '4', 'Cancelada'],
  ['Andrés Rojas', '300 000 0004', 'Mesa 2', '17/10/2026', '13:30', '2', 'Completada'],
  ['Sofía Ruiz', 'Sin contacto', 'Mesa 5', '17/10/2026', '21:00', '6', 'Confirmada'],
  ['Camilo Pardo', '300 000 0006', 'Mesa 8', '17/10/2026', '12:30', '3', 'Completada']
];
const SLOTS_ALMUERZO = ['12:30', '13:30'];
const SLOTS_NOCHE = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
const FONT = {};
const VARS = {};      // token semántico → Variable
const PVARS = {};     // primitivo → Variable
const SPACE = {};     // valor → Variable
const RADIUS = {};    // valor → Variable
const TEXT_STYLES = {};
const EFFECTS = {};
const GRIDS = {};
const ICON = {};      // nombre → ComponentNode
const SETS = {};      // componentes publicados
const PENDING = [];
let DARK_MODE_OK = false;

async function tryFont(family, styles) {
  for (const style of styles) {
    try { await figma.loadFontAsync({ family: family, style: style }); return { family: family, style: style }; } catch (e) { /* siguiente */ }
  }
  return null;
}
async function loadFonts() {
  FONT.reg = await tryFont('Inter', ['Regular']);
  FONT.med = (await tryFont('Inter', ['Medium'])) || FONT.reg;
  FONT.semi = (await tryFont('Inter', ['Semi Bold', 'SemiBold'])) || FONT.med;
  FONT.bold = (await tryFont('Inter', ['Bold'])) || FONT.semi;
  FONT.hBold = (await tryFont('Poppins', ['Bold'])) || FONT.bold;
  FONT.hSemi = (await tryFont('Poppins', ['SemiBold', 'Semi Bold'])) || FONT.semi;
}

// ---------------------------------------------------------------------------
// Variables y estilos
// ---------------------------------------------------------------------------
function createVariables() {
  const pc = figma.variables.createVariableCollection('Konys · Primitivos');
  const pm = pc.modes[0].modeId;
  pc.renameMode(pm, 'Valor');
  Object.keys(PRIM).forEach(n => {
    const v = figma.variables.createVariable(n, pc, 'COLOR');
    v.setValueForMode(pm, rgba(PRIM[n], 1));
    PVARS[n] = v;
  });

  const sc = figma.variables.createVariableCollection('Konys · Tokens de color');
  const light = sc.modes[0].modeId;
  sc.renameMode(light, 'Claro');
  let dark = null;
  try { dark = sc.addMode('Oscuro'); DARK_MODE_OK = true; } catch (e) { DARK_MODE_OK = false; }
  SEM.forEach(r => {
    const v = figma.variables.createVariable(r[0], sc, 'COLOR');
    v.description = r[4];
    v.setValueForMode(light, figma.variables.createVariableAlias(PVARS[r[1]]));
    if (dark) v.setValueForMode(dark, figma.variables.createVariableAlias(PVARS[r[2]]));
    VARS[r[0]] = v;
  });

  const nc = figma.variables.createVariableCollection('Konys · Espaciado y radios');
  const nm = nc.modes[0].modeId;
  nc.renameMode(nm, 'Valor');
  SPACE_VALUES.forEach(px => {
    const v = figma.variables.createVariable('espacio/' + px, nc, 'FLOAT');
    v.setValueForMode(nm, px);
    try { v.scopes = ['GAP']; } catch (e) { /* opcional */ }
    SPACE[px] = v;
  });
  Object.keys(RADIUS_VALUES).forEach(k => {
    const v = figma.variables.createVariable('radio/' + k, nc, 'FLOAT');
    v.setValueForMode(nm, RADIUS_VALUES[k]);
    try { v.scopes = ['CORNER_RADIUS']; } catch (e) { /* opcional */ }
    RADIUS[RADIUS_VALUES[k]] = v;
  });
}

function createStyles() {
  Object.keys(TS).forEach(k => {
    const s = TS[k];
    const st = figma.createTextStyle();
    st.name = s.n;
    st.fontName = FONT[s.f];
    st.fontSize = s.s;
    st.lineHeight = { unit: 'PIXELS', value: s.lh };
    if (s.ls) st.letterSpacing = { unit: 'PERCENT', value: s.ls };
    if (s.upper) st.textCase = 'UPPER';
    TEXT_STYLES[k] = st;
  });

  const shadow = (y, blur, a) => ({ type: 'DROP_SHADOW', color: rgba('#0F2B3D', a), offset: { x: 0, y: y }, radius: blur, spread: 0, visible: true, blendMode: 'NORMAL' });
  const e1 = figma.createEffectStyle(); e1.name = 'Sombra/Tarjeta'; e1.effects = [shadow(1, 3, 0.08), shadow(4, 12, 0.06)]; EFFECTS.tarjeta = e1;
  const e2 = figma.createEffectStyle(); e2.name = 'Sombra/Elevada'; e2.effects = [shadow(12, 32, 0.18), shadow(2, 6, 0.08)]; EFFECTS.elevada = e2;

  const gridColor = { r: 0.95, g: 0.55, b: 0.16, a: 0.1 };
  const g1 = figma.createGridStyle(); g1.name = 'Grid/Escritorio · 12 columnas';
  g1.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'CENTER', count: 12, gutterSize: 24, sectionSize: 78, visible: true, color: gridColor }];
  const g2 = figma.createGridStyle(); g2.name = 'Grid/Tablet · 8 columnas';
  g2.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'STRETCH', count: 8, gutterSize: 24, offset: 32, visible: true, color: gridColor }];
  const g3 = figma.createGridStyle(); g3.name = 'Grid/Móvil · 4 columnas';
  g3.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'STRETCH', count: 4, gutterSize: 16, offset: 16, visible: true, color: gridColor }];
  GRIDS.desktop = g1; GRIDS.tablet = g2; GRIDS.mobile = g3;
}

// ---------------------------------------------------------------------------
// Paletas: alta fidelidad (variables enlazadas) y baja fidelidad (grises)
// ---------------------------------------------------------------------------
const HIFI = {
  hifi: true,
  paint(tok, opacity) {
    const v = VARS[tok];
    if (!v) throw new Error('Token inexistente: ' + tok);
    const p = figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: rgb(SEM_LIGHT_HEX[tok]) }, 'color', v);
    return opacity != null ? Object.assign({}, p, { opacity: opacity }) : p;
  },
  prim(name) {
    return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: rgb(PRIM[name]) }, 'color', PVARS[name]);
  }
};
const LOFI_HEX = {};
SEM.forEach(r => { LOFI_HEX[r[0]] = r[3]; });
const LOFI = {
  hifi: false,
  paint(tok, opacity) {
    const h = LOFI_HEX[tok];
    if (!h) throw new Error('Token inexistente: ' + tok);
    const p = { type: 'SOLID', color: rgb(h) };
    if (opacity != null) p.opacity = tok === 'fondo/overlay' ? 0.45 : opacity;
    return p;
  }
};

// Envuelve un hijo para indicar cómo se dimensiona dentro del auto layout del padre
function F(n, fw, fh) { return { n: n, fw: fw !== false, fh: !!fh }; }
function A(n, x, y) { return { n: n, abs: { x: x, y: y } }; }

function recolor(node, tok, P) {
  const paint = P.paint(tok);
  const all = node.findAll ? node.findAll(n => 'strokes' in n && n.strokes.length > 0) : [];
  all.forEach(n => { n.strokes = [paint]; });
}

function ownTexts(node, name) {
  const out = [];
  const walk = n => {
    if (n.type === 'TEXT' && n.name === name) out.push(n);
    if (n.type === 'INSTANCE') return;
    if ('children' in n) n.children.forEach(walk);
  };
  if ('children' in node) node.children.forEach(walk);
  return out;
}

// ---------------------------------------------------------------------------
// Kit de construcción. Ambos niveles de fidelidad comparten las mismas funciones;
// en alta fidelidad, cada función se reemplaza por una instancia del componente publicado.
// ---------------------------------------------------------------------------
function makeKit(P) {
  const K = { P: P };

  function bindNum(f, field, val, map) {
    if (P.hifi && map[val]) { try { f.setBoundVariable(field, map[val]); } catch (e) { /* opcional */ } }
  }

  K.add = (parent, child) => {
    if (!child) return parent;
    const c = typeof child.type === 'string' ? { n: child } : child;
    parent.appendChild(c.n);
    if (c.abs) {
      c.n.layoutPositioning = 'ABSOLUTE';
      c.n.x = c.abs.x; c.n.y = c.abs.y;
      return parent;
    }
    if (c.fw) { c.n.layoutSizingHorizontal = 'FILL'; if (c.n.type === 'TEXT') c.n.textAutoResize = 'HEIGHT'; }
    if (c.fh) c.n.layoutSizingVertical = 'FILL';
    return parent;
  };

  K.box = (o) => {
    o = o || {};
    const f = figma.createFrame();
    f.name = o.name || 'Contenedor';
    f.fills = o.fill ? [P.paint(o.fill, o.opacity)] : [];
    f.clipsContent = !!o.clip;
    if (o.dir) {
      f.layoutMode = o.dir === 'v' ? 'VERTICAL' : 'HORIZONTAL';
      let p = o.pad || 0;
      if (typeof p === 'number') p = [p, p, p, p];
      else if (p.length === 2) p = [p[0], p[1], p[0], p[1]];
      f.paddingTop = p[0]; f.paddingRight = p[1]; f.paddingBottom = p[2]; f.paddingLeft = p[3];
      bindNum(f, 'paddingTop', p[0], SPACE); bindNum(f, 'paddingRight', p[1], SPACE);
      bindNum(f, 'paddingBottom', p[2], SPACE); bindNum(f, 'paddingLeft', p[3], SPACE);
      f.itemSpacing = o.gap || 0;
      bindNum(f, 'itemSpacing', o.gap, SPACE);
      f.primaryAxisAlignItems = o.main || 'MIN';
      f.counterAxisAlignItems = o.cross || 'MIN';
      if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.wrapGap != null ? o.wrapGap : (o.gap || 0); }
    }
    f.resize(o.w || 100, o.h || 100);
    if (o.dir) {
      f.layoutSizingHorizontal = o.w ? 'FIXED' : 'HUG';
      f.layoutSizingVertical = o.h ? 'FIXED' : 'HUG';
    }
    if (o.r != null) {
      f.cornerRadius = o.r;
      ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach(k => bindNum(f, k, o.r, RADIUS));
    }
    if (o.stroke) {
      f.strokes = [P.paint(o.stroke)];
      f.strokeAlign = 'INSIDE';
      f.strokeWeight = o.sw || 1;
      if (o.dash) f.dashPattern = [6, 4];
      if (o.side) {
        f.strokeTopWeight = o.side === 'top' ? (o.sw || 1) : 0;
        f.strokeBottomWeight = o.side === 'bottom' ? (o.sw || 1) : 0;
        f.strokeLeftWeight = o.side === 'left' ? (o.sw || 1) : 0;
        f.strokeRightWeight = o.side === 'right' ? (o.sw || 1) : 0;
      }
    }
    if (o.shadow && P.hifi) PENDING.push(f.setEffectStyleIdAsync(EFFECTS[o.shadow].id));
    if (o.children) o.children.forEach(c => K.add(f, c));
    return f;
  };

  K.text = (str, st, color, o) => {
    st = st || 'body'; color = color || 'texto/principal'; o = o || {};
    const s = TS[st];
    const t = figma.createText();
    t.fontName = FONT[s.f];
    t.fontSize = s.s;
    t.lineHeight = { unit: 'PIXELS', value: s.lh };
    if (s.ls) t.letterSpacing = { unit: 'PERCENT', value: s.ls };
    if (s.upper) t.textCase = 'UPPER';
    t.characters = String(str);
    t.fills = [P.paint(color)];
    if (P.hifi) PENDING.push(t.setTextStyleIdAsync(TEXT_STYLES[st].id));
    t.name = o.name || String(str).slice(0, 40);
    if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); }
    if (o.align) t.textAlignHorizontal = o.align;
    if (o.strike) t.textDecoration = 'STRIKETHROUGH';
    return t;
  };

  K.spacer = () => K.box({ name: 'Espaciador', dir: 'v', w: 1, h: 1 });

  K.dot = (size, color) => {
    const e = figma.createEllipse();
    e.name = 'punto'; e.resize(size, size); e.fills = [P.paint(color)];
    return e;
  };

  K.icon = (name, size, color) => {
    size = size || 20; color = color || 'texto/principal';
    const n = figma.createNodeFromSvg(svgIcon(ICON_SVG[name], '#000000'));
    n.name = 'icono';
    n.fills = [];
    n.children.forEach(c => { try { c.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; } catch (e) { /* grupos */ } });
    recolor(n, color, P);
    if (size !== 24) n.resize(size, size);
    return n;
  };

  K.iconText = (icon, str, color, st) => {
    const b = K.box({ name: str, dir: 'h', gap: 8, cross: 'CENTER' });
    K.add(b, K.icon(icon, 16, color || 'texto/secundario'));
    K.add(b, K.text(str, st || 'bodyS', color || 'texto/secundario'));
    return b;
  };

  // Placeholder de imagen: en alta fidelidad un bloque de marca, en baja fidelidad la clásica "X"
  K.img = (w, h, o) => {
    o = o || {};
    if (P.hifi) {
      const b = K.box({ name: 'Foto', dir: 'v', w: w, h: h, r: o.r != null ? o.r : 0, fill: 'fondo/primario-suave', main: 'CENTER', cross: 'CENTER', gap: 8, clip: true });
      K.add(b, K.icon(o.icon || 'pizza', 32, 'texto/secundario'));
      if (o.label !== false) K.add(b, K.text(o.label || 'Foto', 'caption', 'texto/secundario', { name: 'leyenda' }));
      return b;
    }
    const b = K.box({ name: 'Imagen', dir: 'v', w: w, h: h, r: o.r != null ? o.r : 0, fill: 'fondo/sutil', stroke: 'borde/fuerte', clip: true });
    const x = figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
      '"><path d="M0 0L' + w + ' ' + h + 'M' + w + ' 0L0 ' + h + '" stroke="#AAAAAA" stroke-width="1"/></svg>');
    x.name = 'X'; x.fills = [];
    x.children.forEach(c => { try { c.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; } catch (e) { /* grupos */ } });
    K.add(b, A(x, 0, 0));
    x.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    return b;
  };

  K.logo = (onDark) => {
    if (!P.hifi) {
      const b = K.box({ name: 'Logo', dir: 'h', pad: [8, 20], r: 6, stroke: onDark ? 'texto/invertido' : 'borde/fuerte', main: 'CENTER', cross: 'CENTER' });
      K.add(b, K.text('LOGO', 'caption', onDark ? 'texto/invertido' : 'texto/secundario'));
      return b;
    }
    const b = K.box({ name: 'Logo', dir: 'h', gap: 10, cross: 'CENTER' });
    const c = K.box({ name: 'Isotipo', dir: 'h', w: 40, h: 40, r: 999, fill: 'fondo/acento', main: 'CENTER', cross: 'CENTER' });
    K.add(c, K.text('K', 'h3', 'texto/sobre-acento'));
    K.add(b, c);
    const col = K.box({ name: 'Logotipo', dir: 'v' });
    K.add(col, K.text('KONYS', 'h3', onDark ? 'texto/invertido' : 'texto/marca'));
    K.add(col, K.text('Pizza', 'overline', onDark ? 'texto/acento-claro' : 'texto/acento'));
    K.add(b, col);
    return b;
  };

  // ----- Componentes base -----
  const BTN = {
    'Primario': { bg: 'fondo/primario', fg: 'texto/invertido', hover: 'fondo/primario-hover' },
    'Acento': { bg: 'fondo/acento', fg: 'texto/sobre-acento', hover: 'fondo/acento-hover' },
    'Secundario': { bg: 'fondo/superficie', fg: 'texto/marca', stroke: 'borde/fuerte', hover: 'fondo/sutil' },
    'Fantasma': { bg: null, fg: 'texto/marca', hover: 'fondo/sutil' },
    'Peligro': { bg: 'estado/error', fg: 'texto/invertido', hover: 'estado/error-texto' },
    'Sobre oscuro': { bg: null, fg: 'texto/invertido', stroke: 'texto/invertido', hover: 'fondo/primario-hover' }
  };
  K.BTN = BTN;
  K.btnFg = (o) => (o.estado === 'Deshabilitado' ? 'texto/deshabilitado' : BTN[o.tipo || 'Primario'].fg);
  K.button = (label, o) => {
    o = o || {};
    const t = BTN[o.tipo || 'Primario'];
    const est = o.estado || 'Default';
    let bg = est === 'Hover' ? t.hover : t.bg;
    let stroke = t.stroke;
    if (est === 'Deshabilitado') { bg = t.bg ? 'fondo/deshabilitado' : null; stroke = t.stroke ? 'borde/default' : null; }
    const fg = K.btnFg(o);
    const b = K.box({ name: 'Botón', dir: 'h', pad: [12, 24], gap: 8, main: 'CENTER', cross: 'CENTER', r: 10, fill: bg, stroke: stroke });
    const ic = K.icon(o.icon || 'mas', 20, fg);
    ic.visible = !!o.icon;
    K.add(b, ic);
    K.add(b, K.text(label, 'labelL', fg, { name: 'label' }));
    return b;
  };

  const ICON_BTN = { 'Editar': 'editar', 'Ocultar': 'ojo-cerrado', 'Mostrar': 'ojo', 'Borrar': 'borrar', 'Cerrar': 'x' };
  K.iconButton = (accion) => {
    const b = K.box({ name: 'Botón icono', dir: 'h', w: 36, h: 36, r: 10, main: 'CENTER', cross: 'CENTER', fill: 'fondo/superficie', stroke: 'borde/default' });
    K.add(b, K.icon(ICON_BTN[accion], 18, accion === 'Borrar' ? 'estado/error' : 'texto/secundario'));
    return b;
  };
  K.ICON_BTN = ICON_BTN;

  const BADGE = {
    'Libre': ['estado/libre-fondo', 'estado/libre-texto', 'estado/libre'],
    'Activa': ['estado/libre-fondo', 'estado/libre-texto', 'estado/libre'],
    'Confirmada': ['estado/libre-fondo', 'estado/libre-texto', 'estado/libre'],
    'Ocupada': ['fondo/sutil', 'texto/secundario', 'borde/fuerte'],
    'Inactiva': ['fondo/sutil', 'texto/secundario', 'borde/fuerte'],
    'Seleccionada': ['fondo/primario', 'texto/invertido', 'fondo/acento'],
    'Completada': ['fondo/primario-suave', 'texto/marca', 'fondo/primario'],
    'Cancelada': ['estado/error-fondo', 'estado/error-texto', 'estado/error']
  };
  K.BADGE = BADGE;
  K.badge = (estado, label) => {
    const c = BADGE[estado];
    const b = K.box({ name: 'Badge', dir: 'h', pad: [4, 10], gap: 6, r: 999, cross: 'CENTER', fill: c[0], stroke: P.hifi ? null : 'borde/default' });
    K.add(b, K.dot(8, c[2]));
    K.add(b, K.text(label || estado, 'caption', c[1], { name: 'label' }));
    return b;
  };

  K.chip = (label, activo) => {
    const b = K.box({ name: 'Chip', dir: 'h', pad: [8, 16], r: 999, cross: 'CENTER', fill: activo ? 'fondo/primario' : 'fondo/superficie', stroke: activo ? null : 'borde/default' });
    K.add(b, K.text(label, 'label', activo ? 'texto/invertido' : 'texto/principal', { name: 'label' }));
    return b;
  };

  K.slot = (hora, estado) => {
    estado = estado || 'Libre';
    const S = {
      'Libre': ['fondo/superficie', 'borde/default', 'texto/principal'],
      'Hover': ['fondo/acento-suave', 'borde/foco', 'texto/principal'],
      'Seleccionado': ['fondo/primario', null, 'texto/invertido'],
      'Ocupado': ['fondo/sutil', null, 'texto/terciario']
    }[estado];
    const b = K.box({ name: 'Slot', dir: 'h', w: 96, h: 44, r: 10, gap: 6, main: 'CENTER', cross: 'CENTER', fill: S[0], stroke: S[1], sw: estado === 'Hover' ? 2 : 1 });
    if (estado === 'Seleccionado') K.add(b, K.icon('check', 16, 'texto/invertido'));
    K.add(b, K.text(hora, 'label', S[2], { name: 'label', strike: estado === 'Ocupado' }));
    return b;
  };

  K.day = (n, estado) => {
    estado = estado || 'Disponible';
    const S = {
      'Disponible': [null, null, 'texto/principal'],
      'Hoy': [null, 'borde/foco', 'texto/principal'],
      'Seleccionado': ['fondo/primario', null, 'texto/invertido'],
      'Deshabilitado': [null, null, 'texto/deshabilitado']
    }[estado];
    const b = K.box({ name: 'Día', dir: 'h', w: 40, h: 40, r: 10, main: 'CENTER', cross: 'CENTER', fill: S[0], stroke: S[1], sw: 2 });
    K.add(b, K.text(String(n), estado === 'Deshabilitado' ? 'bodyS' : 'label', S[2], { name: 'label' }));
    return b;
  };

  K.input = (label, ph, o) => {
    o = o || {};
    const est = o.estado || 'Default';
    const tipo = o.tipo || 'Texto';
    const w = K.box({ name: 'Campo', dir: 'v', gap: 6, w: o.w || 320 });
    K.add(w, F(K.text(label, 'label', 'texto/principal', { name: 'label' })));
    const field = K.box({
      name: 'control', dir: 'h', pad: [0, 12], gap: 8, h: 44, cross: 'CENTER', r: 10,
      fill: est === 'Deshabilitado' ? 'fondo/deshabilitado' : 'fondo/superficie',
      stroke: est === 'Foco' ? 'borde/foco' : est === 'Error' ? 'estado/error' : 'borde/default',
      sw: est === 'Foco' || est === 'Error' ? 2 : 1
    });
    const vColor = est === 'Deshabilitado' ? 'texto/deshabilitado' : o.value ? 'texto/principal' : 'texto/terciario';
    K.add(field, F(K.text(o.value || ph, 'body', vColor, { name: 'valor' })));
    const chev = K.icon(o.icon || 'chevron-abajo', 20, 'texto/secundario');
    chev.visible = tipo === 'Selector';
    K.add(field, chev);
    K.add(w, F(field));
    const help = K.text(o.helper || (est === 'Error' ? 'Mensaje de error' : 'Texto de ayuda'), 'caption', est === 'Error' ? 'estado/error-texto' : 'texto/secundario', { name: 'ayuda' });
    K.add(w, F(help));
    help.visible = !!o.helper || est === 'Error';
    return w;
  };

  K.toggle = (on) => {
    const b = K.box({ name: 'Toggle', dir: 'h', w: 44, h: 24, r: 999, pad: [0, 3], cross: 'CENTER', main: on ? 'MAX' : 'MIN', fill: on ? 'estado/libre' : 'borde/fuerte' });
    K.add(b, K.dot(18, 'texto/invertido'));
    return b;
  };

  const ALERT = {
    'Éxito': ['estado/libre-fondo', 'estado/libre', 'estado/libre-texto', 'check-circulo'],
    'Error': ['estado/error-fondo', 'estado/error', 'estado/error-texto', 'alerta'],
    'Aviso': ['estado/aviso-fondo', 'estado/aviso', 'estado/aviso-texto', 'alerta'],
    'Info': ['estado/info-fondo', 'estado/info', 'estado/info-texto', 'info']
  };
  K.alert = (tipo, titulo, msg) => {
    const c = ALERT[tipo];
    const b = K.box({ name: 'Alerta', dir: 'h', w: 400, pad: [12, 16], gap: 12, r: 10, fill: c[0], stroke: c[1] });
    K.add(b, K.icon(c[3], 20, c[2]));
    const col = K.box({ name: 'contenido', dir: 'v', gap: 2 });
    K.add(col, F(K.text(titulo, 'label', c[2], { name: 'titulo' })));
    K.add(col, F(K.text(msg, 'bodyS', 'texto/principal', { name: 'mensaje' })));
    K.add(b, F(col));
    return b;
  };

  K.steps = (paso) => {
    const b = K.box({ name: 'Indicador de pasos', dir: 'h', gap: 8, cross: 'CENTER' });
    ['Fecha', 'Hora', 'Tus datos'].forEach((lbl, i) => {
      const n = i + 1;
      const done = n < paso, cur = n === paso;
      if (i > 0) K.add(b, K.box({ name: 'línea', w: 24, h: 2, fill: done || cur ? 'fondo/primario' : 'borde/default' }));
      const c = K.box({ name: 'número', dir: 'h', w: 28, h: 28, r: 999, main: 'CENTER', cross: 'CENTER', fill: done ? 'estado/libre' : cur ? 'fondo/primario' : null, stroke: done || cur ? null : 'borde/fuerte' });
      if (done) K.add(c, K.icon('check', 16, 'texto/invertido'));
      else K.add(c, K.text(String(n), 'label', cur ? 'texto/invertido' : 'texto/terciario'));
      K.add(b, c);
      K.add(b, K.text(lbl, cur || done ? 'label' : 'bodyS', cur || done ? 'texto/principal' : 'texto/terciario'));
    });
    return b;
  };

  K.navLink = (label, activo) => {
    const b = K.box({ name: 'nav-' + label, dir: 'h', pad: [8, 0], cross: 'CENTER', stroke: activo ? 'texto/acento-claro' : null, side: 'bottom', sw: 2 });
    K.add(b, K.text(label, activo ? 'label' : 'bodyS', activo ? 'texto/invertido' : 'texto/invertido-suave', { name: 'label' }));
    return b;
  };

  K.sideItem = (label, icon, activo) => {
    const fg = activo ? 'texto/sobre-acento' : 'texto/invertido-suave';
    const b = K.box({ name: 'Ítem ' + label, dir: 'h', w: 216, pad: [10, 12], gap: 12, r: 10, cross: 'CENTER', fill: activo ? 'fondo/acento' : null });
    K.add(b, K.icon(icon, 20, fg));
    K.add(b, F(K.text(label, activo ? 'label' : 'bodyS', fg, { name: 'label' })));
    return b;
  };
  K.sideFg = (activo) => (activo ? 'texto/sobre-acento' : 'texto/invertido-suave');

  K.mesaCard = (nombre, zona, cap, estado) => {
    estado = estado || 'Libre';
    const c = K.box({ name: 'Tarjeta de mesa', dir: 'v', w: 282, r: 16, fill: 'fondo/superficie', stroke: 'borde/default', clip: true, shadow: 'tarjeta' });
    K.add(c, F(K.img(282, 160, { label: 'Foto de la mesa' })));
    const body = K.box({ name: 'contenido', dir: 'v', pad: 16, gap: 12 });
    const top = K.box({ name: 'título', dir: 'h', main: 'SPACE_BETWEEN', cross: 'CENTER' });
    K.add(top, K.text(nombre, 'h3', 'texto/principal', { name: 'nombre' }));
    K.add(top, K.badge(estado === 'Libre' ? 'Libre' : 'Ocupada'));
    K.add(body, F(top));
    const meta = K.box({ name: 'meta', dir: 'h', gap: 16, cross: 'CENTER' });
    const z = K.box({ name: 'zona', dir: 'h', gap: 6, cross: 'CENTER' });
    K.add(z, K.icon('ubicacion', 16, 'texto/secundario'));
    K.add(z, K.text(zona, 'bodyS', 'texto/secundario', { name: 'zona' }));
    const p = K.box({ name: 'capacidad', dir: 'h', gap: 6, cross: 'CENTER' });
    K.add(p, K.icon('personas', 16, 'texto/secundario'));
    K.add(p, K.text(cap + ' personas', 'bodyS', 'texto/secundario', { name: 'capacidad' }));
    K.add(meta, z); K.add(meta, p);
    K.add(body, F(meta));
    K.add(body, F(K.button('Ver horarios', { tipo: estado === 'Libre' ? 'Primario' : 'Secundario' })));
    K.add(c, F(body));
    return c;
  };

  K.plato = (nombre, desc, precio) => {
    const c = K.box({ name: 'Tarjeta de plato', dir: 'h', w: 384, pad: 12, gap: 16, r: 16, fill: 'fondo/superficie', stroke: 'borde/default' });
    K.add(c, K.img(96, 96, { r: 10, label: false }));
    const col = K.box({ name: 'contenido', dir: 'v', gap: 4 });
    K.add(col, F(K.text(nombre, 'labelL', 'texto/principal', { name: 'nombre' })));
    K.add(col, F(K.text(desc, 'bodyS', 'texto/secundario', { name: 'descripcion' })));
    K.add(col, F(K.text(precio, 'labelL', 'texto/acento', { name: 'precio' })));
    K.add(c, F(col));
    return c;
  };

  K.header = (o) => {
    o = o || {};
    const active = o.active || 'Inicio';
    if (o.mobile) {
      const h = K.box({ name: 'Encabezado', dir: 'h', w: 390, h: 64, pad: [0, 16], main: 'SPACE_BETWEEN', cross: 'CENTER', fill: 'fondo/primario' });
      K.add(h, K.logo(true));
      K.add(h, K.icon('menu', 24, 'texto/invertido'));
      return h;
    }
    const h = K.box({ name: 'Encabezado', dir: 'h', w: 1440, h: 72, pad: [0, 120], main: 'SPACE_BETWEEN', cross: 'CENTER', fill: 'fondo/primario' });
    K.add(h, K.logo(true));
    const nav = K.box({ name: 'navegación', dir: 'h', gap: 32, cross: 'CENTER' });
    ['Inicio', 'Mesas', 'Carta', 'Reservar', 'Contacto'].forEach(l => K.add(nav, K.navLink(l, l === active)));
    K.add(h, nav);
    K.add(h, K.button('Admin', { tipo: 'Sobre oscuro', icon: 'candado' }));
    return h;
  };

  K.footer = (o) => {
    o = o || {};
    const mob = !!o.mobile;
    const f = K.box({ name: 'Pie de página', dir: 'v', w: mob ? 390 : 1440, pad: mob ? [32, 16] : [48, 120], gap: 32, fill: 'fondo/primario' });
    const cols = K.box({ name: 'columnas', dir: mob ? 'v' : 'h', gap: mob ? 24 : 64 });
    const c1 = K.box({ name: 'marca', dir: 'v', gap: 12 });
    K.add(c1, K.logo(true));
    K.add(c1, K.text('La pizza más icónica de la ciudad.', 'bodyS', 'texto/invertido-suave'));
    K.add(cols, c1);
    const col = (t, items) => {
      const c = K.box({ name: t, dir: 'v', gap: 12 });
      K.add(c, K.text(t, 'overline', 'texto/acento-claro'));
      items.forEach(it => K.add(c, K.iconText(it[0], it[1], 'texto/invertido-suave')));
      return c;
    };
    K.add(cols, col('Visítanos', [['ubicacion', 'Cra. 36 con calle 41, Bucaramanga']]));
    K.add(cols, col('Horario', [['reloj', '12:30 – 2:30 p. m.'], ['reloj', '5:00 – 11:00 p. m.']]));
    K.add(cols, col('Contacto', [['telefono', 'WhatsApp +57 300 000 0000'], ['instagram', '@konys_pizza']]));
    K.add(f, F(cols));
    K.add(f, F(K.box({ name: 'divisor', dir: 'h', h: 1, fill: 'texto/invertido-suave', opacity: 0.2 })));
    K.add(f, K.text('© 2026 Konys Pizza · Domicilios y eventos', 'caption', 'texto/invertido-suave'));
    return f;
  };

  // ----- Patrones (sin componente propio; se arman con componentes) -----
  K.grid = (nodes, cols, gap, name) => {
    const g = K.box({ name: name || 'Grilla', dir: 'v', gap: gap });
    for (let i = 0; i < nodes.length; i += cols) {
      const row = K.box({ name: 'fila', dir: 'h', gap: gap });
      for (let j = 0; j < cols; j++) {
        const n = nodes[i + j] || K.box({ name: 'vacío', dir: 'v', h: 1 });
        K.add(row, F(n));
      }
      K.add(g, F(row));
    }
    return g;
  };

  K.legend = () => {
    const b = K.box({ name: 'Leyenda', dir: 'h', gap: 16, cross: 'CENTER' });
    [['Libre', 'fondo/superficie', 'borde/default'], ['Ocupado', 'fondo/sutil', null], ['Seleccionado', 'fondo/primario', null]].forEach(l => {
      const it = K.box({ name: l[0], dir: 'h', gap: 6, cross: 'CENTER' });
      K.add(it, K.box({ name: 'muestra', w: 14, h: 14, r: 4, fill: l[1], stroke: l[2] || 'borde/default' }));
      K.add(it, K.text(l[0], 'caption', 'texto/secundario'));
      K.add(b, it);
    });
    return b;
  };

  K.calendar = (sel, today) => {
    const c = K.box({ name: 'Calendario', dir: 'v', gap: 8 });
    const head = K.box({ name: 'mes', dir: 'h', main: 'SPACE_BETWEEN', cross: 'CENTER', w: 304 });
    K.add(head, K.icon('chevron-izq', 20, 'texto/secundario'));
    K.add(head, K.text('Octubre 2026', 'label', 'texto/principal'));
    K.add(head, K.icon('chevron-der', 20, 'texto/secundario'));
    head.layoutSizingVertical = 'HUG';
    K.add(c, head);
    const wd = K.box({ name: 'días de la semana', dir: 'h', gap: 4 });
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(d => {
      const cell = K.box({ name: d, dir: 'h', w: 40, h: 24, main: 'CENTER', cross: 'CENTER' });
      K.add(cell, K.text(d, 'caption', 'texto/terciario'));
      K.add(wd, cell);
    });
    K.add(c, wd);
    // 1 de octubre de 2026 es jueves → 3 celdas vacías con semana iniciando en lunes
    const offset = 3;
    for (let w = 0; w < 5; w++) {
      const row = K.box({ name: 'semana ' + (w + 1), dir: 'h', gap: 4 });
      for (let d = 0; d < 7; d++) {
        const n = w * 7 + d - offset + 1;
        if (n < 1 || n > 31) { K.add(row, K.box({ name: 'vacío', w: 40, h: 40 })); continue; }
        const est = n === sel ? 'Seleccionado' : n === today ? 'Hoy' : n < today ? 'Deshabilitado' : 'Disponible';
        K.add(row, K.day(n, est));
      }
      K.add(c, row);
    }
    return c;
  };

  K.table = (cols, rows, o) => {
    o = o || {};
    const t = K.box({ name: o.name || 'Tabla', dir: 'v', r: o.bare ? null : 16, fill: 'fondo/superficie', stroke: o.bare ? null : 'borde/default', clip: true });
    const mkRow = (cells, header) => {
      const r = K.box({ name: header ? 'encabezado' : 'fila', dir: 'h', h: header ? 44 : 64, pad: [0, 16], gap: 16, cross: 'CENTER', fill: header ? 'fondo/sutil' : null, stroke: 'borde/default', side: 'bottom' });
      cells.forEach((cell, i) => {
        const col = cols[i];
        const wrap = K.box({ name: col.h || 'celda', dir: 'h', gap: 8, cross: 'CENTER', w: col.w || 100 });
        if (typeof cell === 'string' || typeof cell === 'number') {
          K.add(wrap, F(K.text(String(cell), header ? 'overline' : 'bodyS', header ? 'texto/secundario' : 'texto/principal')));
        } else if (Array.isArray(cell)) {
          cell.forEach(c => K.add(wrap, c));
        } else if (cell) {
          K.add(wrap, cell);
        }
        wrap.layoutSizingVertical = 'HUG';
        if (!col.w) K.add(r, F(wrap)); else K.add(r, wrap);
      });
      return r;
    };
    K.add(t, F(mkRow(cols.map(c => c.h), true)));
    rows.forEach(r => K.add(t, F(mkRow(r, false))));
    return t;
  };

  K.stack = (label, sub) => {
    const b = K.box({ name: label, dir: 'v', gap: 2 });
    K.add(b, F(K.text(label, 'label', 'texto/principal')));
    if (sub) K.add(b, F(K.text(sub, 'caption', 'texto/secundario')));
    return b;
  };

  K.timeField = (v) => {
    const b = K.box({ name: 'Hora', dir: 'h', pad: [6, 10], gap: 6, r: 6, cross: 'CENTER', fill: 'fondo/superficie', stroke: 'borde/default' });
    K.add(b, K.icon('reloj', 14, 'texto/secundario'));
    K.add(b, K.text(v, 'bodyS', 'texto/principal'));
    return b;
  };

  return K;
}

// ---------------------------------------------------------------------------
// Componentes publicados
// ---------------------------------------------------------------------------
function makeSet(name, entries, parent, width, description) {
  const comps = entries.map(e => {
    const c = figma.createComponentFromNode(e.node);
    c.name = Object.keys(e.props).map(k => k + '=' + e.props[k]).join(', ');
    return c;
  });
  const set = figma.combineAsVariants(comps, parent);
  set.name = name;
  if (description) set.description = description;
  set.layoutMode = 'HORIZONTAL';
  set.layoutWrap = 'WRAP';
  set.itemSpacing = 24;
  set.counterAxisSpacing = 24;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
  set.counterAxisAlignItems = 'MIN';
  set.resize(width || 1280, 100);
  set.layoutSizingHorizontal = 'FIXED';
  set.layoutSizingVertical = 'HUG';
  set.fills = [HIFI.paint('fondo/superficie')];
  set.strokes = [{ type: 'SOLID', color: rgb('#9747FF') }];
  set.dashPattern = [6, 4];
  set.cornerRadius = 16;
  return set;
}
function pick(set, props) {
  const c = set.children.find(ch => Object.keys(props).every(k => ch.variantProperties && ch.variantProperties[k] === props[k]));
  if (!c) throw new Error('Variante no encontrada en ' + set.name + ': ' + JSON.stringify(props));
  return c;
}
function setText(node, layer, value) {
  const t = node.findOne(n => n.type === 'TEXT' && n.name === layer);
  if (t && value != null) t.characters = String(value);
  return t;
}
function textProp(set, prop, layer, def) {
  try {
    const key = set.addComponentProperty(prop, 'TEXT', def);
    set.children.forEach(v => ownTexts(v, layer).forEach(t => { t.componentPropertyReferences = { characters: key }; }));
  } catch (e) { console.warn('Propiedad ' + prop + ': ' + e.message); }
}
function textPropSingle(comp, prop, layer, def) {
  try {
    const key = comp.addComponentProperty(prop, 'TEXT', def);
    ownTexts(comp, layer).forEach(t => { t.componentPropertyReferences = { characters: key }; });
  } catch (e) { console.warn('Propiedad ' + prop + ': ' + e.message); }
}
function nestedIcon(inst) {
  return inst.findOne(n => n.type === 'INSTANCE' && n.name === 'icono');
}

// ---------------------------------------------------------------------------
// Documentación del sistema (página "Sistema de diseño")
// ---------------------------------------------------------------------------
function section(H, root, num, title, desc) {
  const s = H.box({ name: num + ' · ' + title, dir: 'v', gap: 32 });
  const head = H.box({ name: 'encabezado', dir: 'v', gap: 8 });
  H.add(head, H.text(num, 'overline', 'texto/acento'));
  H.add(head, H.text(title, 'h1', 'texto/marca'));
  if (desc) H.add(head, H.text(desc, 'bodyL', 'texto/secundario', { w: 880 }));
  H.add(s, F(head));
  H.add(root, F(s));
  return s;
}
function block(H, parent, title, desc, usage) {
  const b = H.box({ name: title, dir: 'v', gap: 16 });
  H.add(b, H.text(title, 'h2', 'texto/principal'));
  if (desc) H.add(b, H.text(desc, 'body', 'texto/secundario', { w: 880 }));
  if (usage && usage.length) {
    const u = H.box({ name: 'Uso', dir: 'v', gap: 6 });
    usage.forEach(x => {
      const row = H.box({ name: 'regla', dir: 'h', gap: 8 });
      H.add(row, H.text('•', 'bodyS', 'texto/acento'));
      H.add(row, H.text(x, 'bodyS', 'texto/principal', { w: 860 }));
      H.add(u, row);
    });
    H.add(b, u);
  }
  H.add(parent, F(b));
  return b;
}
function card(H, w, children) {
  const c = H.box({ name: 'Tarjeta', dir: 'v', w: w, pad: 24, gap: 12, r: 16, fill: 'fondo/superficie', stroke: 'borde/default' });
  children.forEach(ch => H.add(c, ch));
  return c;
}

function buildTokensDoc(H, root) {
  // Principios
  const s0 = section(H, root, '01', 'Principios de diseño', 'Decisiones que guían cada pantalla del Sistema de Reservas de Konys Pizza. Se derivan de los requisitos no funcionales del documento de proyecto.');
  const pr = H.box({ name: 'principios', dir: 'h', gap: 24, wrap: true, w: 1280 });
  [
    ['Reservar en 3 pasos', 'Fecha → hora → datos. Sin registro ni pagos. Un indicador de pasos muestra el avance (RNF-01).', 'check-circulo'],
    ['Mobile first', 'La mayoría de clientes llega desde el celular: grilla de 4 columnas, botones de ancho completo y slots en 3 columnas (RNF-02).', 'telefono'],
    ['Disponibilidad visible', 'Libre, ocupado y seleccionado se distinguen por color, borde, ícono y texto tachado, nunca solo por color (RF-04).', 'calendario'],
    ['Accesible y legible', 'Todos los pares de texto cumplen contraste WCAG AA (≥ 4.5:1). Foco visible en naranja de 2 px.', 'ojo']
  ].forEach(p => {
    const ic = H.box({ name: 'ícono', dir: 'h', w: 44, h: 44, r: 10, fill: 'fondo/acento-suave', main: 'CENTER', cross: 'CENTER' });
    H.add(ic, H.icon(p[2], 22, 'texto/acento'));
    H.add(pr, card(H, 302, [ic, F(H.text(p[0], 'h3', 'texto/marca')), F(H.text(p[1], 'bodyS', 'texto/secundario'))]));
  });
  H.add(s0, pr);

  // Color
  const s1 = section(H, root, '02', 'Color', 'Paleta sugerida en §11.3: azul petróleo oscuro #0F2B3D (fondo del logo, sobriedad) como primario y naranja #F28C28 (color del logo) como acento para botones y títulos clave. Los colores se publican como variables en dos niveles: primitivos (valores) y tokens semánticos (uso). Los componentes solo usan tokens semánticos.');
  const fams = { 'Azul petróleo (primario)': 'azul/', 'Naranja (acento)': 'naranja/', 'Neutros': 'neutro/', 'Verde (disponible)': 'verde/', 'Rojo (error)': 'rojo/' };
  Object.keys(fams).forEach(f => {
    const b = H.box({ name: f, dir: 'v', gap: 12 });
    H.add(b, H.text(f, 'h3', 'texto/principal'));
    const row = H.box({ name: 'muestras', dir: 'h', gap: 16, wrap: true, w: 1280 });
    Object.keys(PRIM).filter(k => k.indexOf(fams[f]) === 0).forEach(k => {
      const sw = H.box({ name: k, dir: 'v', gap: 6, w: 140 });
      const chip = H.box({ name: 'color', w: 140, h: 72, r: 10, stroke: 'borde/default' });
      chip.fills = [HIFI.prim(k)];
      H.add(sw, chip);
      H.add(sw, H.text(k, 'label', 'texto/principal'));
      H.add(sw, H.text(PRIM[k], 'caption', 'texto/secundario'));
      H.add(row, sw);
    });
    H.add(b, row);
    H.add(s1, F(b));
  });

  const semB = block(H, s1, 'Tokens semánticos', 'Cada token apunta a un primitivo. Modo "Claro" activo; el modo "Oscuro" queda preparado para la mejora futura de modo oscuro (§17.1).' + (DARK_MODE_OK ? '' : ' (Tu plan de Figma solo permite un modo: el modo oscuro no se creó.)'));
  const rows = SEM.map(r => {
    const sw = H.box({ name: 'muestra', w: 32, h: 32, r: 6, fill: r[0], stroke: 'borde/default' });
    return [sw, H.text(r[0], 'label', 'texto/principal'), H.text('→ ' + r[1], 'caption', 'texto/secundario'), H.text(r[4], 'bodyS', 'texto/secundario')];
  });
  H.add(semB, F(H.table([{ h: '', w: 32 }, { h: 'Token', w: 240 }, { h: 'Primitivo', w: 160 }, { h: 'Uso' }], rows, { name: 'Tokens semánticos' })));

  const conB = block(H, s1, 'Contraste (WCAG 2.1)', 'Ratios calculados automáticamente a partir de los valores de la paleta. AA exige 4.5:1 para texto normal y 3:1 para texto grande y componentes de interfaz.');
  const pairs = [
    ['texto/principal', 'fondo/superficie'], ['texto/secundario', 'fondo/superficie'], ['texto/terciario', 'fondo/superficie'],
    ['texto/invertido', 'fondo/primario'], ['texto/invertido-suave', 'fondo/primario'], ['texto/acento-claro', 'fondo/primario'],
    ['texto/sobre-acento', 'fondo/acento'], ['texto/acento', 'fondo/superficie'], ['estado/libre-texto', 'estado/libre-fondo'],
    ['estado/error-texto', 'estado/error-fondo'], ['texto/invertido', 'estado/error'], ['texto/marca', 'fondo/primario-suave']
  ];
  const cRows = pairs.map(p => {
    const ratio = contrast(SEM_LIGHT_HEX[p[0]], SEM_LIGHT_HEX[p[1]]);
    const sample = H.box({ name: 'muestra', dir: 'h', pad: [6, 12], r: 6, fill: p[1], stroke: 'borde/default' });
    H.add(sample, H.text('Aa Reserva', 'label', p[0]));
    const ok = ratio >= 4.5 ? H.badge('Confirmada', 'AA') : ratio >= 3 ? H.badge('Completada', 'AA texto grande') : H.badge('Cancelada', 'No cumple');
    return [sample, H.text(p[0] + '  sobre  ' + p[1], 'bodyS', 'texto/principal'), H.text(ratio.toFixed(2) + ' : 1', 'label', 'texto/principal'), ok];
  });
  H.add(conB, F(H.table([{ h: 'Muestra', w: 140 }, { h: 'Combinación' }, { h: 'Ratio', w: 120 }, { h: 'Resultado', w: 180 }], cRows, { name: 'Contraste' })));

  // Tipografía
  const s2 = section(H, root, '03', 'Tipografía', 'Poppins (títulos) e Inter (texto e interfaz), ambas de Google Fonts, como sugiere §11.3. Escala con base 16 px y alturas de línea en múltiplos de 4. Publicadas como estilos de texto.');
  const tRows = H.box({ name: 'escala', dir: 'v', w: 1280 });
  Object.keys(TS).forEach(k => {
    const s = TS[k];
    const row = H.box({ name: s.n, dir: 'h', gap: 32, pad: [20, 0], cross: 'CENTER', stroke: 'borde/default', side: 'bottom' });
    const info = H.box({ name: 'info', dir: 'v', gap: 4, w: 300 });
    H.add(info, H.text(s.n, 'label', 'texto/principal'));
    H.add(info, H.text(FONT[s.f].family + ' ' + FONT[s.f].style + ' · ' + s.s + '/' + s.lh + (s.ls ? ' · ' + s.ls + ' %' : ''), 'caption', 'texto/secundario'));
    info.layoutSizingVertical = 'HUG';
    H.add(row, info);
    H.add(row, F(H.text(k.indexOf('display') === 0 ? 'Konys Pizza' : 'Reserva tu mesa en Konys', k, 'texto/principal')));
    H.add(tRows, F(row));
  });
  H.add(s2, tRows);

  // Espaciado, radios, sombras
  const s3 = section(H, root, '04', 'Espaciado, radios y elevación', 'Sistema de 4 px. Los valores se publican como variables numéricas y están enlazados a los rellenos, separaciones y esquinas de los componentes.');
  const row3 = H.box({ name: 'fila', dir: 'h', gap: 48, w: 1280 });
  const spc = H.box({ name: 'Espaciado', dir: 'v', gap: 10 });
  H.add(spc, H.text('Espaciado', 'h3', 'texto/principal'));
  SPACE_VALUES.forEach(v => {
    const r = H.box({ name: 'espacio/' + v, dir: 'h', gap: 12, cross: 'CENTER' });
    H.add(r, H.text('espacio/' + v, 'bodyS', 'texto/secundario', { w: 110 }));
    H.add(r, H.box({ name: 'barra', w: v, h: 16, r: 4, fill: 'fondo/acento' }));
    H.add(r, H.text(v + ' px', 'caption', 'texto/secundario'));
    H.add(spc, r);
  });
  H.add(row3, spc);
  const rad = H.box({ name: 'Radios', dir: 'v', gap: 12 });
  H.add(rad, H.text('Radios', 'h3', 'texto/principal'));
  const radRow = H.box({ name: 'muestras', dir: 'h', gap: 16 });
  Object.keys(RADIUS_VALUES).forEach(k => {
    const c = H.box({ name: k, dir: 'v', gap: 6, cross: 'CENTER' });
    H.add(c, H.box({ name: 'muestra', w: 72, h: 72, r: Math.min(RADIUS_VALUES[k], 36), fill: 'fondo/primario-suave', stroke: 'fondo/primario' }));
    H.add(c, H.text('radio/' + k, 'label', 'texto/principal'));
    H.add(c, H.text(RADIUS_VALUES[k] === 999 ? 'Pastilla' : RADIUS_VALUES[k] + ' px', 'caption', 'texto/secundario'));
    H.add(radRow, c);
  });
  H.add(rad, radRow);
  H.add(rad, H.text('sm: indicadores · md: botones, campos, slots · lg: tarjetas y tablas · xl: modales · full: badges y chips', 'bodyS', 'texto/secundario', { w: 440 }));
  H.add(row3, rad);
  const sh = H.box({ name: 'Elevación', dir: 'v', gap: 12 });
  H.add(sh, H.text('Elevación', 'h3', 'texto/principal'));
  const shRow = H.box({ name: 'muestras', dir: 'h', gap: 24 });
  [['tarjeta', 'Sombra/Tarjeta', 'Tarjetas de mesa'], ['elevada', 'Sombra/Elevada', 'Modales y menús']].forEach(e => {
    const c = H.box({ name: e[1], dir: 'v', w: 160, h: 110, pad: 16, gap: 4, r: 16, fill: 'fondo/superficie', shadow: e[0], main: 'MAX' });
    H.add(c, H.text(e[1], 'label', 'texto/principal'));
    H.add(c, H.text(e[2], 'caption', 'texto/secundario'));
    H.add(shRow, c);
  });
  H.add(sh, shRow);
  H.add(row3, sh);
  H.add(s3, row3);

  // Grillas y breakpoints
  const s4 = section(H, root, '05', 'Grillas y puntos de quiebre', 'Diseño responsivo (RNF-02) con enfoque mobile first. Las grillas están publicadas como estilos de cuadrícula y aplicadas a cada pantalla.');
  const gRow = H.box({ name: 'grillas', dir: 'h', gap: 32, wrap: true, w: 1280 });
  const demo = (label, spec, real, cols, gutter, margin, scale) => {
    const W = Math.round(real * scale), Hh = 140;
    const fr = H.box({ name: 'ilustración', w: W, h: Hh, r: 10, fill: 'fondo/superficie', stroke: 'borde/default', clip: true });
    const inner = real - margin * 2;
    const cw = (inner - gutter * (cols - 1)) / cols;
    for (let i = 0; i < cols; i++) {
      const col = figma.createRectangle();
      col.name = 'columna';
      col.resize(Math.max(1, cw * scale), Hh);
      col.x = (margin + i * (cw + gutter)) * scale; col.y = 0;
      col.fills = [HIFI.paint('fondo/acento-suave')];
      fr.appendChild(col);
    }
    const c = H.box({ name: label, dir: 'v', gap: 8 });
    H.add(c, fr);
    H.add(c, H.text(label, 'label', 'texto/principal'));
    H.add(c, H.text(spec, 'caption', 'texto/secundario'));
    return c;
  };
  H.add(gRow, demo('Móvil · 360–767 px', '4 columnas · margen 16 · separación 16 · frame 390', 390, 4, 16, 16, 0.6));
  H.add(gRow, demo('Tablet · 768–1199 px', '8 columnas · margen 32 · separación 24', 768, 8, 24, 32, 0.5));
  H.add(gRow, demo('Escritorio · ≥ 1200 px', '12 columnas · contenedor 1200 · separación 24 · frame 1440', 1440, 12, 24, 120, 0.42));
  H.add(s4, gRow);
}

function buildComponents(H, root) {
  const s = section(H, root, '07', 'Componentes', 'Componentes con variantes construidos con auto layout y enlazados a las variables. Los mockups de alta fidelidad usan exclusivamente instancias de estos componentes.');
  const W = 1280;

  let b = block(H, s, 'Botón', 'Acción principal y secundarias. Un solo botón Acento por vista (CTA).', [
    'Acento: llamada a la acción del cliente ("Reserva tu mesa", "Confirmar reserva").',
    'Primario: acciones principales del panel admin y navegación ("Ingresar", "Filtrar").',
    'Secundario / Fantasma: acciones alternativas ("Ver la carta", "Cancelar").',
    'Peligro: acciones destructivas (borrar mesa o plato), siempre con confirmación.',
    'Sobre oscuro: botones encima del encabezado o del hero.'
  ]);
  const be = [];
  Object.keys(H.BTN).forEach(t => ['Default', 'Hover', 'Deshabilitado'].forEach(e => be.push({ props: { Tipo: t, Estado: e }, node: H.button('Botón', { tipo: t, estado: e }) })));
  SETS.btn = makeSet('Botón', be, b, W, 'Botón con 6 tipos y 3 estados. Activa el ícono con la capa "icono".');
  textProp(SETS.btn, 'Texto', 'label', 'Botón');
  H.button = (label, o) => {
    o = o || {};
    const inst = pick(SETS.btn, { Tipo: o.tipo || 'Primario', Estado: o.estado || 'Default' }).createInstance();
    setText(inst, 'label', label);
    const ic = nestedIcon(inst);
    if (ic) {
      if (o.icon) { ic.visible = true; ic.swapComponent(ICON[o.icon]); recolor(ic, H.btnFg(o), HIFI); } else ic.visible = false;
    }
    return inst;
  };

  b = block(H, s, 'Botón de ícono', 'Acciones compactas dentro de tablas del panel de administración.', ['Usar siempre con tooltip/etiqueta accesible ("Editar mesa").']);
  SETS.iconBtn = makeSet('Botón de ícono', Object.keys(H.ICON_BTN).map(a => ({ props: { 'Acción': a }, node: H.iconButton(a) })), b, W);
  H.iconButton = (a) => pick(SETS.iconBtn, { 'Acción': a }).createInstance();

  b = block(H, s, 'Badge de estado', 'Comunica el estado de mesas y reservas con color + punto + texto.', [
    'Mesas: Libre / Ocupada / Seleccionada / Activa / Inactiva (RF-01, RF-13).',
    'Reservas: Confirmada / Cancelada / Completada (modelo de datos §10.3).'
  ]);
  SETS.badge = makeSet('Badge', Object.keys(H.BADGE).map(e => ({ props: { Estado: e }, node: H.badge(e) })), b, W);
  textProp(SETS.badge, 'Texto', 'label', 'Estado');
  H.badge = (e, label) => { const i = pick(SETS.badge, { Estado: e }).createInstance(); if (label) setText(i, 'label', label); return i; };

  b = block(H, s, 'Chip de filtro', 'Filtra mesas por zona y la carta por categoría.', ['Solo un chip activo por grupo.']);
  SETS.chip = makeSet('Chip', [{ props: { Activo: 'Sí' }, node: H.chip('Terraza', true) }, { props: { Activo: 'No' }, node: H.chip('Salón', false) }], b, W);
  textProp(SETS.chip, 'Texto', 'label', 'Filtro');
  H.chip = (l, a) => { const i = pick(SETS.chip, { Activo: a ? 'Sí' : 'No' }).createInstance(); setText(i, 'label', l); return i; };

  b = block(H, s, 'Slot horario', 'Bloque de tiempo reservable (RF-04). Libre en blanco, ocupado en gris y tachado, seleccionado en azul con check.', [
    'Los slots se generan a partir de hora_inicio, hora_fin y duracion_slot de la colección horarios.',
    'Un slot ocupado no es clicable; si se intenta reservar se muestra la Alerta de error (flujo alternativo CU-02).'
  ]);
  SETS.slot = makeSet('Slot horario', ['Libre', 'Hover', 'Seleccionado', 'Ocupado'].map(e => ({ props: { Estado: e }, node: H.slot('19:00', e) })), b, W);
  textProp(SETS.slot, 'Hora', 'label', '19:00');
  H.slot = (h, e) => { const i = pick(SETS.slot, { Estado: e || 'Libre' }).createInstance(); setText(i, 'label', h); return i; };

  b = block(H, s, 'Día de calendario', 'Celda del selector de fecha (RF-03). Solo se habilitan días dentro del horario de operación.', []);
  SETS.day = makeSet('Día de calendario', ['Disponible', 'Hoy', 'Seleccionado', 'Deshabilitado'].map(e => ({ props: { Estado: e }, node: H.day(17, e) })), b, W);
  textProp(SETS.day, 'Día', 'label', '17');
  H.day = (n, e) => { const i = pick(SETS.day, { Estado: e || 'Disponible' }).createInstance(); setText(i, 'label', n); return i; };

  b = block(H, s, 'Campo de formulario', 'Campos de texto y selectores con etiqueta visible, ayuda y mensaje de error.', [
    'La etiqueta nunca se reemplaza por el placeholder.',
    'Error: borde rojo de 2 px + mensaje que explica cómo corregir ("Máximo 6 personas para esta mesa").'
  ]);
  const ie = [];
  ['Texto', 'Selector'].forEach(t => ['Default', 'Foco', 'Error', 'Deshabilitado'].forEach(e => ie.push({ props: { Tipo: t, Estado: e }, node: H.input('Etiqueta', t === 'Selector' ? 'Selecciona una opción' : 'Placeholder', { tipo: t, estado: e, w: 280 }) })));
  SETS.input = makeSet('Campo', ie, b, W);
  textProp(SETS.input, 'Etiqueta', 'label', 'Etiqueta');
  H.input = (label, ph, o) => {
    o = o || {};
    const est = o.estado || 'Default';
    const i = pick(SETS.input, { Tipo: o.tipo || 'Texto', Estado: est }).createInstance();
    setText(i, 'label', label);
    const v = setText(i, 'valor', o.value || ph);
    if (v) v.fills = [HIFI.paint(est === 'Deshabilitado' ? 'texto/deshabilitado' : o.value ? 'texto/principal' : 'texto/terciario')];
    const help = i.findOne(n => n.type === 'TEXT' && n.name === 'ayuda');
    if (help) { if (o.helper) { help.characters = o.helper; help.visible = true; } else if (est !== 'Error') help.visible = false; }
    if (o.icon) { const ic = nestedIcon(i); if (ic) { ic.visible = true; ic.swapComponent(ICON[o.icon]); recolor(ic, 'texto/secundario', HIFI); } }
    if (o.w) i.resize(o.w, i.height);
    return i;
  };

  b = block(H, s, 'Toggle', 'Activa / desactiva mesas (RF-13), jornadas de horario (RF-11) y platos (RF-14).', ['Acompañar siempre con texto de estado ("Activa" / "Inactiva").']);
  SETS.toggle = makeSet('Toggle', [{ props: { Activo: 'Sí' }, node: H.toggle(true) }, { props: { Activo: 'No' }, node: H.toggle(false) }], b, W);
  H.toggle = (on) => pick(SETS.toggle, { Activo: on ? 'Sí' : 'No' }).createInstance();

  b = block(H, s, 'Alerta', 'Mensajes de retroalimentación del sistema.', ['Error: slot ya ocupado o datos inválidos (flujo alternativo CU-02).', 'Info: recordatorios en la confirmación.']);
  SETS.alert = makeSet('Alerta', ['Éxito', 'Error', 'Aviso', 'Info'].map(t => ({ props: { Tipo: t }, node: H.alert(t, 'Título de la alerta', 'Mensaje breve que explica qué pasó y qué hacer.') })), b, W);
  textProp(SETS.alert, 'Título', 'titulo', 'Título de la alerta');
  textProp(SETS.alert, 'Mensaje', 'mensaje', 'Mensaje breve');
  H.alert = (t, ti, m) => { const i = pick(SETS.alert, { Tipo: t }).createInstance(); setText(i, 'titulo', ti); setText(i, 'mensaje', m); return i; };

  b = block(H, s, 'Indicador de pasos', 'Muestra el avance del flujo de reserva: Fecha → Hora → Tus datos (RNF-01: reservar en menos de 3 pasos).', []);
  SETS.steps = makeSet('Indicador de pasos', [1, 2, 3].map(n => ({ props: { Paso: String(n) }, node: H.steps(n) })), b, W);
  H.steps = (n) => pick(SETS.steps, { Paso: String(n) }).createInstance();

  b = block(H, s, 'Navegación', 'Enlace del encabezado público e ítem del menú lateral del panel de administración.', []);
  SETS.nav = makeSet('Navegación/Enlace', [{ props: { Activo: 'Sí' }, node: H.navLink('Inicio', true) }, { props: { Activo: 'No' }, node: H.navLink('Mesas', false) }], b, W);
  SETS.nav.fills = [HIFI.paint('fondo/primario')];
  textProp(SETS.nav, 'Texto', 'label', 'Enlace');
  H.navLink = (l, a) => { const i = pick(SETS.nav, { Activo: a ? 'Sí' : 'No' }).createInstance(); i.name = 'nav-' + l; setText(i, 'label', l); return i; };
  SETS.side = makeSet('Navegación/Ítem admin', [{ props: { Activo: 'Sí' }, node: H.sideItem('Reservas', 'calendario', true) }, { props: { Activo: 'No' }, node: H.sideItem('Mesas', 'mesa', false) }], b, W);
  SETS.side.fills = [HIFI.paint('fondo/primario')];
  textProp(SETS.side, 'Texto', 'label', 'Sección');
  H.sideItem = (l, icon, a) => {
    const i = pick(SETS.side, { Activo: a ? 'Sí' : 'No' }).createInstance();
    i.name = 'Ítem ' + l;
    setText(i, 'label', l);
    const ic = nestedIcon(i);
    if (ic) { ic.swapComponent(ICON[icon]); recolor(ic, H.sideFg(a), HIFI); }
    return i;
  };

  b = block(H, s, 'Logo', 'Isotipo + logotipo provisional. Reemplazar por el logo oficial de Konys cuando esté disponible.', []);
  SETS.logo = makeSet('Logo', [{ props: { Fondo: 'Oscuro' }, node: H.logo(true) }, { props: { Fondo: 'Claro' }, node: H.logo(false) }], b, W);
  pick(SETS.logo, { Fondo: 'Oscuro' }).fills = [HIFI.paint('fondo/primario')];
  H.logo = (dark) => pick(SETS.logo, { Fondo: dark ? 'Oscuro' : 'Claro' }).createInstance();

  b = block(H, s, 'Tarjeta de mesa', 'Representación visual de cada mesa (RF-01): foto, nombre, zona, capacidad y estado. Al hacer clic abre el flujo de reserva (RF-02).', [
    'Los datos vienen de la colección mesas (nombre, zona, capacidad, activa, foto_url).',
    'Las mesas inactivas no se muestran al cliente (RF-13).'
  ]);
  SETS.mesa = makeSet('Tarjeta de mesa', [{ props: { Estado: 'Libre' }, node: H.mesaCard('Mesa 3', 'Salón', 6, 'Libre') }, { props: { Estado: 'Ocupada' }, node: H.mesaCard('Mesa 4', 'Salón', 4, 'Ocupada') }], b, W);
  textProp(SETS.mesa, 'Nombre', 'nombre', 'Mesa 3');
  textProp(SETS.mesa, 'Zona', 'zona', 'Salón');
  textProp(SETS.mesa, 'Capacidad', 'capacidad', '6 personas');
  H.mesaCard = (n, z, c, e) => { const i = pick(SETS.mesa, { Estado: e || 'Libre' }).createInstance(); setText(i, 'nombre', n); setText(i, 'zona', z); setText(i, 'capacidad', c + ' personas'); return i; };

  b = block(H, s, 'Tarjeta de plato', 'Ítem de la carta digital (RF-07): nombre, descripción y precio en COP. Los platos con disponible = false no se muestran.', []);
  const pf = H.box({ name: 'contenedor', dir: 'h', pad: 32, r: 16, fill: 'fondo/superficie', stroke: 'borde/default', dash: true });
  const plato = figma.createComponentFromNode(H.plato('Pizza Konys Especial', PLATOS[0][2], '$38.000'));
  plato.name = 'Tarjeta de plato';
  H.add(pf, plato);
  textPropSingle(plato, 'Nombre', 'nombre', 'Pizza Konys Especial');
  textPropSingle(plato, 'Descripción', 'descripcion', 'Descripción');
  textPropSingle(plato, 'Precio', 'precio', '$38.000');
  H.add(b, pf);
  SETS.plato = plato;
  H.plato = (n, d, p) => { const i = plato.createInstance(); setText(i, 'nombre', n); setText(i, 'descripcion', d); setText(i, 'precio', p); return i; };

  b = block(H, s, 'Encabezado y pie de página', 'Encabezado con logo, navegación (Inicio, Mesas, Carta, Reservar, Contacto) y botón discreto de acceso admin (§11.1). Pie con dirección, horario, WhatsApp y redes.', []);
  SETS.header = makeSet('Encabezado', [{ props: { Dispositivo: 'Escritorio' }, node: H.header({}) }, { props: { Dispositivo: 'Móvil' }, node: H.header({ mobile: true }) }], b, 1600);
  H.header = (o) => {
    o = o || {};
    const i = pick(SETS.header, { Dispositivo: o.mobile ? 'Móvil' : 'Escritorio' }).createInstance();
    if (!o.mobile) {
      ['Inicio', 'Mesas', 'Carta', 'Reservar', 'Contacto'].forEach(l => {
        const n = i.findOne(x => x.type === 'INSTANCE' && x.name === 'nav-' + l);
        if (n) n.setProperties({ Activo: l === (o.active || 'Inicio') ? 'Sí' : 'No' });
      });
    }
    return i;
  };
  SETS.footer = makeSet('Pie de página', [{ props: { Dispositivo: 'Escritorio' }, node: H.footer({}) }, { props: { Dispositivo: 'Móvil' }, node: H.footer({ mobile: true }) }], b, 1600);
  H.footer = (o) => pick(SETS.footer, { Dispositivo: o && o.mobile ? 'Móvil' : 'Escritorio' }).createInstance();

  // Patrones compuestos
  b = block(H, s, 'Patrones', 'Composiciones reutilizables armadas con los componentes anteriores.', ['Calendario = Día de calendario × 7 columnas.', 'Grilla de horarios = Slot horario (4 columnas en escritorio, 3 en móvil) + Leyenda.']);
  const pt = H.box({ name: 'patrones', dir: 'h', gap: 48, pad: 32, r: 16, fill: 'fondo/superficie', stroke: 'borde/default' });
  H.add(pt, H.calendar(17, 15));
  const sl = H.box({ name: 'Grilla de horarios', dir: 'v', gap: 12, w: 420 });
  H.add(sl, H.text('Noche · 5:00 – 11:00 p. m.', 'label', 'texto/secundario'));
  H.add(sl, F(H.grid(SLOTS_NOCHE.map(h => H.slot(h, h === '19:00' ? 'Seleccionado' : h === '20:00' ? 'Ocupado' : 'Libre')), 4, 8)));
  H.add(sl, H.legend());
  H.add(pt, sl);
  H.add(b, pt);
}

function buildIcons(H, root) {
  const s = section(H, root, '06', 'Iconografía', 'Íconos SVG simples de trazo 2 px (§11.3), en cuadrícula de 24 px. Publicados como componentes: el color se cambia con un override del trazo.');
  const grid = H.box({ name: 'íconos', dir: 'h', gap: 16, wrap: true, w: 1280 });
  Object.keys(ICON_SVG).forEach(k => {
    const raw = H.icon(k, 24, 'texto/principal');
    const comp = figma.createComponentFromNode(raw);
    comp.name = 'Icono/' + ICON_LABEL[k];
    ICON[k] = comp;
    const cell = H.box({ name: ICON_LABEL[k], dir: 'v', w: 112, pad: [16, 8], gap: 8, r: 10, cross: 'CENTER', fill: 'fondo/superficie', stroke: 'borde/default' });
    H.add(cell, comp);
    H.add(cell, H.text(ICON_LABEL[k], 'caption', 'texto/secundario'));
    H.add(grid, cell);
  });
  H.add(s, grid);
  H.icon = (name, size, color) => {
    const i = ICON[name].createInstance();
    i.name = 'icono';
    size = size || 20;
    if (size !== 24) i.resize(size, size);
    recolor(i, color || 'texto/principal', HIFI);
    return i;
  };
}

function buildTraceability(H, root) {
  const s = section(H, root, '08', 'Trazabilidad', 'Cada requisito funcional del documento se cubre con componentes y pantallas concretas.');
  const rows = [
    ['RF-01', 'Visualización de mesas', 'Tarjeta de mesa, Badge, Chip', 'Inicio (escritorio y móvil)'],
    ['RF-02', 'Selección de mesa', 'Tarjeta de mesa, Botón', 'Inicio → Reserva'],
    ['RF-03', 'Elección de fecha', 'Día de calendario, Calendario', 'Reserva (escritorio y móvil)'],
    ['RF-04', 'Horarios disponibles', 'Slot horario, Leyenda', 'Reserva'],
    ['RF-05', 'Reserva de mesa', 'Campo, Botón Acento, Alerta', 'Reserva, Reserva · error'],
    ['RF-06', 'Confirmación de reserva', 'Alerta, resumen', 'Confirmación (escritorio y móvil)'],
    ['RF-07', 'Carta digital', 'Tarjeta de plato, Chip', 'Carta, Inicio'],
    ['RF-08', 'Acceso al panel', 'Campo, Botón, Logo', 'Admin · Acceso, Admin · Acceso error'],
    ['RF-09', 'Registro de mesas', 'Campo, Chip, Toggle', 'Admin · Nueva mesa'],
    ['RF-10', 'Listado de mesas', 'Tabla, Toggle, Botón de ícono', 'Admin · Mesas'],
    ['RF-11', 'Gestión de horarios', 'Campo selector, Toggle', 'Admin · Horarios'],
    ['RF-12', 'Visualización de reservas', 'Tabla, Badge, Campo selector', 'Admin · Reservas'],
    ['RF-13', 'Cambio de estado de mesa', 'Toggle, Badge', 'Admin · Mesas'],
    ['RF-14', 'Gestión de la carta', 'Tabla, Toggle, Botón de ícono', 'Admin · Carta'],
    ['RNF-01', 'Usabilidad (≤ 3 pasos)', 'Indicador de pasos', 'Reserva'],
    ['RNF-02', 'Responsividad', 'Grillas 4/8/12 columnas', 'Versión móvil + escritorio'],
    ['RNF-05', 'Seguridad del panel', 'Campo contraseña', 'Admin · Acceso']
  ].map(r => [H.badge('Completada', r[0]), H.text(r[1], 'label', 'texto/principal'), H.text(r[2], 'bodyS', 'texto/secundario'), H.text(r[3], 'bodyS', 'texto/secundario')]);
  H.add(s, F(H.table([{ h: 'Código', w: 120 }, { h: 'Requisito', w: 280 }, { h: 'Componentes', w: 360 }, { h: 'Pantallas' }], rows, { name: 'Trazabilidad' })));

  const s2 = section(H, root, '09', 'Contenido y microcopia', 'Tono cercano, directo y en segunda persona (tú). Mensajes cortos que dicen qué pasó y qué hacer.');
  const ex = [
    ['Llamada a la acción', '"Reserva tu mesa"', '"Enviar formulario"'],
    ['Slot ocupado', '"Ese horario acaba de ser reservado. Elige otro."', '"Error 409"'],
    ['Capacidad superada', '"Máximo 6 personas para esta mesa."', '"Valor inválido"'],
    ['Confirmación', '"¡Reserva confirmada! Te esperamos."', '"Operación exitosa"'],
    ['Acceso admin', '"Contraseña incorrecta. Inténtalo de nuevo."', '"Acceso denegado"']
  ].map(r => [H.text(r[0], 'label', 'texto/principal'), H.badge('Confirmada', 'Sí') , H.text(r[1], 'bodyS', 'texto/principal'), H.badge('Cancelada', 'No'), H.text(r[2], 'bodyS', 'texto/secundario')]);
  H.add(s2, F(H.table([{ h: 'Situación', w: 220 }, { h: '', w: 60 }, { h: 'Escribe así' }, { h: '', w: 60 }, { h: 'Evita', w: 260 }], ex, { name: 'Microcopia' })));
}

// ---------------------------------------------------------------------------
// Pantallas (se construyen igual con el kit de alta o de baja fidelidad)
// ---------------------------------------------------------------------------
function screen(K, name, w, o) {
  o = o || {};
  const s = K.box({ name: name, dir: o.dir || 'v', w: w, h: o.h, fill: o.fill || 'fondo/pagina', clip: true, main: o.main, cross: o.cross });
  if (K.P.hifi) PENDING.push(s.setGridStyleIdAsync((w <= 400 ? GRIDS.mobile : GRIDS.desktop).id));
  return s;
}

function heroDesktop(K) {
  const hero = K.box({ name: 'Hero', dir: 'h', pad: [80, 120], gap: 64, cross: 'CENTER', fill: 'fondo/primario' });
  const col = K.box({ name: 'texto', dir: 'v', gap: 24 });
  K.add(col, K.text('Pizzería en Bucaramanga', 'overline', 'texto/acento-claro'));
  K.add(col, K.text('Konys Pizza', 'display', 'texto/invertido'));
  K.add(col, K.text('La pizza más icónica de la ciudad. Reserva tu mesa en menos de un minuto, sin llamadas ni esperas.', 'bodyL', 'texto/invertido-suave', { w: 520 }));
  const btns = K.box({ name: 'acciones', dir: 'h', gap: 16 });
  K.add(btns, K.button('Reserva tu mesa', { tipo: 'Acento', icon: 'calendario' }));
  K.add(btns, K.button('Ver la carta', { tipo: 'Sobre oscuro' }));
  K.add(col, btns);
  const info = K.box({ name: 'info', dir: 'h', gap: 24 });
  K.add(info, K.iconText('reloj', '12:30 – 2:30 p. m. · 5:00 – 11:00 p. m.', 'texto/invertido-suave'));
  K.add(info, K.iconText('ubicacion', 'Cra. 36 con calle 41', 'texto/invertido-suave'));
  K.add(col, info);
  K.add(hero, F(col));
  K.add(hero, K.img(520, 380, { r: 24, label: 'Foto del local / pizza destacada' }));
  return hero;
}

function scrInicio(K) {
  const s = screen(K, 'Escritorio · Inicio', 1440);
  K.add(s, F(K.header({ active: 'Inicio' })));
  K.add(s, F(heroDesktop(K)));

  const sec = K.box({ name: 'Sección mesas', dir: 'v', pad: [80, 120], gap: 32 });
  const head = K.box({ name: 'encabezado', dir: 'h', main: 'SPACE_BETWEEN', cross: 'MAX' });
  const t = K.box({ name: 'títulos', dir: 'v', gap: 8 });
  K.add(t, K.text('Nuestras mesas', 'h1', 'texto/marca'));
  K.add(t, K.text('Elige una mesa para ver sus horarios disponibles.', 'body', 'texto/secundario'));
  K.add(head, t);
  const chips = K.box({ name: 'filtros', dir: 'h', gap: 8 });
  [['Todas', true], ['Terraza', false], ['Salón', false]].forEach(c => K.add(chips, K.chip(c[0], c[1])));
  K.add(head, chips);
  K.add(sec, F(head));
  K.add(sec, F(K.grid(MESAS.map(m => K.mesaCard(m[0], m[1], m[2], m[3])), 4, 24, 'Grilla de mesas')));
  K.add(s, F(sec));

  const carta = K.box({ name: 'Sección carta', dir: 'v', pad: [80, 120], gap: 32, fill: 'fondo/superficie' });
  const ch = K.box({ name: 'encabezado', dir: 'h', main: 'SPACE_BETWEEN', cross: 'CENTER' });
  K.add(ch, K.text('Nuestra carta', 'h1', 'texto/marca'));
  K.add(ch, K.button('Ver carta completa', { tipo: 'Secundario', icon: 'carta' }));
  K.add(carta, F(ch));
  const cc = K.box({ name: 'categorías', dir: 'h', gap: 8 });
  [['Pizzas', true], ['Entradas', false], ['Postres', false], ['Bebidas', false]].forEach(c => K.add(cc, K.chip(c[0], c[1])));
  K.add(carta, cc);
  K.add(carta, F(K.grid(PLATOS.slice(0, 6).map(p => K.plato(p[0], p[2], p[3])), 3, 24, 'Grilla de platos')));
  K.add(s, F(carta));
  K.add(s, F(K.footer({})));
  return s;
}

function reservaModal(K, o) {
  o = o || {};
  const mob = !!o.mobile;
  const err = !!o.error;
  const sel = err ? null : '19:00';
  const ocupados = ['13:30', '20:00', '21:00'];
  const est = h => (h === sel ? 'Seleccionado' : ocupados.indexOf(h) >= 0 ? 'Ocupado' : 'Libre');
  const cols = mob ? 3 : 4;

  const left = K.box({ name: 'fecha y hora', dir: 'v', gap: 24, w: mob ? null : 440 });
  K.add(left, K.text('1. Elige la fecha', 'h3', 'texto/principal'));
  K.add(left, K.calendar(17, 15));
  K.add(left, K.text('2. Elige la hora', 'h3', 'texto/principal'));
  if (err) K.add(left, F(K.alert('Error', 'Ese horario acaba de ser reservado', 'Otra persona tomó las 20:00 hace un momento. Elige otro horario.')));
  K.add(left, K.text('Almuerzo · 12:30 – 2:30 p. m.', 'label', 'texto/secundario'));
  K.add(left, F(K.grid(SLOTS_ALMUERZO.map(h => K.slot(h, est(h))), cols, 8, 'Slots almuerzo')));
  K.add(left, K.text('Noche · 5:00 – 11:00 p. m.', 'label', 'texto/secundario'));
  K.add(left, F(K.grid(SLOTS_NOCHE.map(h => K.slot(h, est(h))), cols, 8, 'Slots noche')));
  K.add(left, K.legend());

  const right = K.box({ name: 'datos', dir: 'v', gap: 20 });
  K.add(right, K.text('3. Tus datos', 'h3', 'texto/principal'));
  K.add(right, F(K.input('Nombre completo', 'Ej: Juan Pérez', { value: 'Juan Pérez' })));
  K.add(right, F(K.input('Teléfono / WhatsApp (opcional)', '300 000 0000', { helper: 'Solo lo usaremos si necesitamos contactarte.' })));
  K.add(right, F(err
    ? K.input('Número de personas', 'Ej: 4', { value: '8', estado: 'Error', helper: 'Máximo 6 personas para esta mesa.' })
    : K.input('Número de personas', 'Ej: 4', { value: '4', helper: 'Máximo 6 personas para esta mesa.' })));
  const sum = K.box({ name: 'Resumen', dir: 'v', pad: 20, gap: 12, r: 16, fill: 'fondo/sutil' });
  K.add(sum, K.text('Resumen de tu reserva', 'label', 'texto/principal'));
  K.add(sum, K.iconText('mesa', 'Mesa 3 · Salón'));
  K.add(sum, K.iconText('calendario', 'Sábado 17 de octubre de 2026'));
  K.add(sum, K.iconText('reloj', err ? 'Elige un horario' : '7:00 – 8:00 p. m. (60 min)'));
  K.add(sum, K.iconText('personas', err ? '8 personas' : '4 personas'));
  K.add(right, F(sum));
  K.add(right, F(K.button('Confirmar reserva', { tipo: 'Acento', estado: err ? 'Deshabilitado' : 'Default', icon: 'check' })));
  K.add(right, F(K.text('No necesitas registrarte ni pagar por adelantado.', 'caption', 'texto/secundario', { align: 'CENTER' })));
  return { left: left, right: right };
}

function scrReserva(K, error) {
  const s = screen(K, error ? 'Escritorio · Reserva · error (flujo alternativo)' : 'Escritorio · Reserva (modal)', 1440, { h: 1180 });
  K.add(s, F(K.header({ active: 'Reservar' })));
  K.add(s, F(heroDesktop(K)));
  const ov = K.box({ name: 'Overlay', w: 1440, h: 1180, fill: 'fondo/overlay', opacity: 0.6 });
  K.add(s, A(ov, 0, 0));

  const m = K.box({ name: 'Modal de reserva', dir: 'v', w: 1000, r: 24, fill: 'fondo/superficie', shadow: 'elevada', clip: true });
  const head = K.box({ name: 'encabezado', dir: 'h', pad: [24, 32], main: 'SPACE_BETWEEN', cross: 'CENTER', stroke: 'borde/default', side: 'bottom' });
  const ht = K.box({ name: 'título', dir: 'v', gap: 4 });
  K.add(ht, K.text('Reservar', 'overline', 'texto/acento'));
  K.add(ht, K.text('Mesa 3 · Salón', 'h2', 'texto/marca'));
  K.add(ht, K.iconText('personas', 'Hasta 6 personas'));
  K.add(head, ht);
  K.add(head, K.iconButton('Cerrar'));
  K.add(m, F(head));
  const st = K.box({ name: 'pasos', dir: 'h', pad: [16, 32], fill: 'fondo/sutil' });
  K.add(st, K.steps(error ? 2 : 3));
  K.add(m, F(st));
  const body = K.box({ name: 'cuerpo', dir: 'h', pad: 32, gap: 40 });
  const parts = reservaModal(K, { error: error });
  K.add(body, parts.left);
  K.add(body, F(parts.right));
  K.add(m, F(body));
  K.add(s, A(m, 220, 60));
  return s;
}

function confirmContent(K, mob) {
  const c = K.box({ name: 'Comprobante', dir: 'v', w: mob ? null : 560, pad: mob ? 24 : 40, gap: 24, r: 24, fill: 'fondo/superficie', stroke: 'borde/default', shadow: 'tarjeta', cross: 'CENTER' });
  const ok = K.box({ name: 'ícono éxito', dir: 'h', w: 80, h: 80, r: 999, fill: 'estado/libre-fondo', main: 'CENTER', cross: 'CENTER' });
  K.add(ok, K.icon('check', 40, 'estado/libre-texto'));
  K.add(c, ok);
  K.add(c, K.text('¡Reserva confirmada!', mob ? 'h2' : 'h1', 'texto/marca', { align: 'CENTER' }));
  K.add(c, F(K.text('Te esperamos en Konys Pizza. Guarda este comprobante o tómale una captura de pantalla.', 'body', 'texto/secundario', { align: 'CENTER' })));
  const det = K.box({ name: 'Detalle', dir: 'v', pad: 20, gap: 12, r: 16, fill: 'fondo/sutil' });
  [['Código', 'KP-1017-1900'], ['Nombre', 'Juan Pérez'], ['Mesa', 'Mesa 3 · Salón'], ['Fecha', 'Sáb 17 oct 2026'], ['Hora', '7:00 – 8:00 p. m.'], ['Personas', '4']].forEach(r => {
    const row = K.box({ name: r[0], dir: 'h', main: 'SPACE_BETWEEN', cross: 'CENTER' });
    K.add(row, K.text(r[0], 'bodyS', 'texto/secundario'));
    K.add(row, K.text(r[1], 'label', 'texto/principal'));
    K.add(det, F(row));
  });
  K.add(c, F(det));
  K.add(c, F(K.alert('Info', 'Si no puedes asistir', 'Escríbenos por WhatsApp para liberar la mesa y que otra persona pueda reservarla.')));
  const btns = K.box({ name: 'acciones', dir: mob ? 'v' : 'h', gap: 12 });
  K.add(btns, F(K.button('Volver al inicio', { tipo: 'Primario' })));
  K.add(btns, F(K.button('Ver la carta', { tipo: 'Secundario' })));
  K.add(c, F(btns));
  return c;
}

function scrConfirmacion(K) {
  const s = screen(K, 'Escritorio · Confirmación', 1440);
  K.add(s, F(K.header({ active: 'Reservar' })));
  const b = K.box({ name: 'contenido', dir: 'v', pad: [64, 0], cross: 'CENTER' });
  K.add(b, confirmContent(K, false));
  K.add(s, F(b));
  K.add(s, F(K.footer({})));
  return s;
}

function cartaBody(K, mob) {
  const b = K.box({ name: 'Carta', dir: 'v', pad: mob ? [32, 16] : [64, 120], gap: mob ? 24 : 40 });
  const t = K.box({ name: 'títulos', dir: 'v', gap: 8 });
  K.add(t, K.text('Carta digital', 'overline', 'texto/acento'));
  K.add(t, K.text('Nuestra carta', mob ? 'h2' : 'h1', 'texto/marca'));
  K.add(t, F(K.text('Precios en pesos colombianos (COP). Solo consulta: los pedidos a domicilio siguen por WhatsApp.', 'body', 'texto/secundario')));
  K.add(b, F(t));
  const cc = K.box({ name: 'categorías', dir: 'h', gap: 8, clip: true });
  [['Pizzas', true], ['Entradas', false], ['Postres', false], ['Bebidas', false]].forEach(c => K.add(cc, K.chip(c[0], c[1])));
  K.add(b, F(cc));
  ['Pizzas', 'Entradas', 'Postres', 'Bebidas'].forEach(cat => {
    const items = PLATOS.filter(p => p[1] === cat && p[4]);
    const g = K.box({ name: cat, dir: 'v', gap: 16 });
    K.add(g, K.text(cat, mob ? 'h3' : 'h2', 'texto/principal'));
    K.add(g, F(K.grid(items.map(p => K.plato(p[0], p[2], p[3])), mob ? 1 : 3, mob ? 12 : 24, 'Platos ' + cat)));
    K.add(b, F(g));
  });
  return b;
}

function scrCarta(K) {
  const s = screen(K, 'Escritorio · Carta digital', 1440);
  K.add(s, F(K.header({ active: 'Carta' })));
  K.add(s, F(cartaBody(K, false)));
  K.add(s, F(K.footer({})));
  return s;
}

function scrLogin(K, error) {
  const s = screen(K, error ? 'Admin · Acceso · error' : 'Admin · Acceso (/admin)', 1440, { h: 900, main: 'CENTER', cross: 'CENTER' });
  const c = K.box({ name: 'Tarjeta de acceso', dir: 'v', w: 420, pad: 40, gap: 24, r: 24, fill: 'fondo/superficie', stroke: 'borde/default', shadow: 'elevada', cross: 'CENTER' });
  K.add(c, K.logo(false));
  const t = K.box({ name: 'títulos', dir: 'v', gap: 8, cross: 'CENTER' });
  K.add(t, K.text('Panel de administración', 'h2', 'texto/marca', { align: 'CENTER' }));
  K.add(t, F(K.text('Ingresa la contraseña del administrador para continuar.', 'bodyS', 'texto/secundario', { align: 'CENTER' })));
  K.add(c, F(t));
  K.add(c, F(error
    ? K.input('Contraseña', '••••••••', { value: '••••••', estado: 'Error', helper: 'Contraseña incorrecta. Inténtalo de nuevo.' })
    : K.input('Contraseña', 'Escribe la contraseña', { value: '••••••••', estado: 'Foco' })));
  K.add(c, F(K.button('Ingresar', { tipo: 'Primario', icon: 'candado' })));
  K.add(c, K.button('Volver al sitio', { tipo: 'Fantasma', icon: 'flecha-izq' }));
  K.add(s, c);
  return s;
}

function adminShell(K, active, title, sub, action) {
  const s = screen(K, 'Admin · ' + active, 1440, { dir: 'h', h: 1000 });
  const side = K.box({ name: 'Menú lateral', dir: 'v', w: 248, pad: [24, 16], gap: 8, fill: 'fondo/primario' });
  const lg = K.box({ name: 'logo', dir: 'h', pad: [0, 8, 24, 8], gap: 8, cross: 'CENTER' });
  K.add(lg, K.logo(true));
  K.add(lg, K.text('Admin', 'caption', 'texto/invertido-suave'));
  K.add(side, lg);
  K.add(side, K.text('Gestión', 'overline', 'texto/invertido-suave'));
  [['Mesas', 'mesa'], ['Horarios', 'reloj'], ['Reservas', 'calendario'], ['Carta', 'carta']].forEach(i => K.add(side, F(K.sideItem(i[0], i[1], i[0] === active))));
  K.add(side, F(K.spacer(), true, true));
  K.add(side, F(K.sideItem('Cerrar sesión', 'salir', false)));
  K.add(s, F(side, false, true));
  const main = K.box({ name: 'Contenido', dir: 'v', pad: [40, 48], gap: 24 });
  const head = K.box({ name: 'encabezado', dir: 'h', main: 'SPACE_BETWEEN', cross: 'CENTER' });
  const t = K.box({ name: 'títulos', dir: 'v', gap: 4 });
  K.add(t, K.text(title, 'h1', 'texto/marca'));
  K.add(t, K.text(sub, 'body', 'texto/secundario'));
  K.add(head, t);
  if (action) K.add(head, action);
  K.add(main, F(head));
  K.add(s, F(main, true, true));
  return { s: s, main: main };
}

function scrAdminReservas(K) {
  const a = adminShell(K, 'Reservas', 'Reservas', 'Consulta y filtra las reservas registradas (RF-12).', null);
  const card = K.box({ name: 'Tarjeta', dir: 'v', r: 16, fill: 'fondo/superficie', stroke: 'borde/default', clip: true });
  const tb = K.box({ name: 'Filtros', dir: 'h', pad: 20, gap: 12, cross: 'MAX', stroke: 'borde/default', side: 'bottom' });
  K.add(tb, K.input('Fecha', 'dd/mm/aaaa', { value: '17/10/2026', tipo: 'Selector', icon: 'calendario', w: 200 }));
  K.add(tb, K.input('Mesa', 'Todas las mesas', { tipo: 'Selector', w: 200 }));
  K.add(tb, K.input('Estado', 'Todos', { tipo: 'Selector', w: 180 }));
  K.add(tb, K.button('Filtrar', { tipo: 'Primario', icon: 'filtro' }));
  K.add(tb, K.button('Limpiar', { tipo: 'Fantasma' }));
  K.add(card, F(tb));
  const rows = RESERVAS.map(r => [K.stack(r[0], r[1]), r[2], r[3], r[4], r[5], K.badge(r[6])]);
  K.add(card, F(K.table([{ h: 'Cliente' }, { h: 'Mesa', w: 120 }, { h: 'Fecha', w: 140 }, { h: 'Hora', w: 100 }, { h: 'Personas', w: 100 }, { h: 'Estado', w: 140 }], rows, { bare: true })));
  const pg = K.box({ name: 'Paginación', dir: 'h', pad: [16, 20], main: 'SPACE_BETWEEN', cross: 'CENTER' });
  K.add(pg, K.text('Mostrando 6 de 24 reservas', 'bodyS', 'texto/secundario'));
  const pages = K.box({ name: 'páginas', dir: 'h', gap: 4 });
  K.add(pages, K.icon('chevron-izq', 20, 'texto/secundario'));
  ['1', '2', '3', '4'].forEach(p => K.add(pages, K.day(p, p === '1' ? 'Seleccionado' : 'Disponible')));
  K.add(pages, K.icon('chevron-der', 20, 'texto/secundario'));
  pages.counterAxisAlignItems = 'CENTER';
  K.add(pg, pages);
  K.add(card, F(pg));
  K.add(a.main, F(card));
  return a.s;
}

function mesasAdminRows(K) {
  const data = MESAS.map(m => [m[0], m[1], m[2], true]).concat([['Mesa 9', 'Terraza', 4, false]]);
  return data.map(m => {
    const st = K.box({ name: 'estado', dir: 'h', gap: 8, cross: 'CENTER' });
    K.add(st, K.toggle(m[3]));
    K.add(st, K.badge(m[3] ? 'Activa' : 'Inactiva'));
    return [K.text(m[0], 'label', 'texto/principal'), m[1], m[2] + ' personas', st, [K.iconButton('Editar'), K.iconButton('Borrar')]];
  });
}

function scrAdminMesas(K) {
  const a = adminShell(K, 'Mesas', 'Mesas', 'Registra mesas y actívalas o desactívalas (RF-09, RF-10, RF-13).', K.button('Nueva mesa', { tipo: 'Acento', icon: 'mas' }));
  const card = K.box({ name: 'Tarjeta', dir: 'v', r: 16, fill: 'fondo/superficie', stroke: 'borde/default', clip: true });
  const tb = K.box({ name: 'Filtros', dir: 'h', pad: 20, main: 'SPACE_BETWEEN', cross: 'CENTER', stroke: 'borde/default', side: 'bottom' });
  const chips = K.box({ name: 'zonas', dir: 'h', gap: 8 });
  [['Todas', true], ['Terraza', false], ['Salón', false]].forEach(c => K.add(chips, K.chip(c[0], c[1])));
  K.add(tb, chips);
  K.add(tb, K.text('9 mesas · 8 activas', 'bodyS', 'texto/secundario'));
  K.add(card, F(tb));
  K.add(card, F(K.table([{ h: 'Mesa' }, { h: 'Zona', w: 160 }, { h: 'Capacidad', w: 160 }, { h: 'Estado', w: 200 }, { h: 'Acciones', w: 100 }], mesasAdminRows(K), { bare: true })));
  K.add(a.main, F(card));
  return a.s;
}

function scrNuevaMesa(K) {
  const s = scrAdminMesas(K);
  s.name = 'Admin · Nueva mesa (modal)';
  K.add(s, A(K.box({ name: 'Overlay', w: 1440, h: 1000, fill: 'fondo/overlay', opacity: 0.6 }), 0, 0));
  const m = K.box({ name: 'Modal nueva mesa', dir: 'v', w: 520, r: 24, fill: 'fondo/superficie', shadow: 'elevada', clip: true });
  const head = K.box({ name: 'encabezado', dir: 'h', pad: [20, 24], main: 'SPACE_BETWEEN', cross: 'CENTER', stroke: 'borde/default', side: 'bottom' });
  K.add(head, K.text('Nueva mesa', 'h2', 'texto/marca'));
  K.add(head, K.iconButton('Cerrar'));
  K.add(m, F(head));
  const body = K.box({ name: 'formulario', dir: 'v', pad: 24, gap: 20 });
  K.add(body, F(K.input('Nombre o número', 'Ej: Mesa 10', { value: 'Mesa 10' })));
  const z = K.box({ name: 'zona', dir: 'v', gap: 8 });
  K.add(z, K.text('Zona', 'label', 'texto/principal'));
  const zc = K.box({ name: 'opciones', dir: 'h', gap: 8 });
  K.add(zc, K.chip('Terraza', true)); K.add(zc, K.chip('Salón', false));
  K.add(z, zc);
  K.add(body, F(z));
  K.add(body, F(K.input('Capacidad (personas)', 'Ej: 4', { value: '4', helper: 'Número máximo de personas que caben en la mesa.' })));
  const ft = K.box({ name: 'foto', dir: 'v', gap: 8 });
  K.add(ft, K.text('Foto (opcional)', 'label', 'texto/principal'));
  const drop = K.box({ name: 'Zona de carga', dir: 'v', h: 120, gap: 6, r: 16, main: 'CENTER', cross: 'CENTER', stroke: 'borde/fuerte', dash: true, fill: 'fondo/pagina' });
  K.add(drop, K.icon('subir', 24, 'texto/secundario'));
  K.add(drop, K.text('Arrastra una foto o haz clic para subirla', 'bodyS', 'texto/principal'));
  K.add(drop, K.text('JPG o PNG · máx. 2 MB', 'caption', 'texto/secundario'));
  K.add(ft, F(drop));
  K.add(body, F(ft));
  const act = K.box({ name: 'activa', dir: 'h', gap: 12, cross: 'CENTER' });
  K.add(act, K.toggle(true));
  K.add(act, K.stack('Mesa activa', 'Disponible para recibir reservas'));
  K.add(body, F(act));
  K.add(m, F(body));
  const foot = K.box({ name: 'acciones', dir: 'h', pad: [16, 24], gap: 12, main: 'MAX', stroke: 'borde/default', side: 'top' });
  K.add(foot, K.button('Cancelar', { tipo: 'Fantasma' }));
  K.add(foot, K.button('Guardar mesa', { tipo: 'Primario', icon: 'check' }));
  K.add(m, F(foot));
  K.add(s, A(m, 460, 120));
  return s;
}

function scrAdminHorarios(K) {
  const a = adminShell(K, 'Horarios', 'Horarios de atención', 'Define las jornadas por día y la duración de cada reserva (RF-11).', K.button('Guardar cambios', { tipo: 'Primario', icon: 'check' }));
  const dur = K.box({ name: 'Duración', dir: 'h', pad: 20, gap: 24, r: 16, cross: 'CENTER', fill: 'fondo/superficie', stroke: 'borde/default' });
  K.add(dur, K.input('Duración de cada reserva', '60 minutos', { value: '60 minutos', tipo: 'Selector', w: 240 }));
  K.add(dur, F(K.text('Se usa para generar los slots que ve el cliente. Ej.: almuerzo 12:30 – 14:30 con 60 min → 12:30 y 13:30.', 'bodyS', 'texto/secundario')));
  K.add(a.main, F(dur));
  const jor = (i, f) => [K.timeField(i), K.text('a', 'bodyS', 'texto/secundario'), K.timeField(f), K.toggle(true)];
  const rows = DIAS.map(d => [K.text(d, 'label', 'texto/principal'), jor('12:30', '14:30'), jor('17:00', '23:00'), [K.iconButton('Editar')]]);
  K.add(a.main, F(K.table([{ h: 'Día', w: 160 }, { h: 'Almuerzo' }, { h: 'Noche' }, { h: 'Acciones', w: 80 }], rows, { name: 'Tabla de horarios' })));
  return a.s;
}

function scrAdminCarta(K) {
  const a = adminShell(K, 'Carta', 'Carta', 'Agrega, edita, oculta o elimina platos (RF-14).', K.button('Nuevo plato', { tipo: 'Acento', icon: 'mas' }));
  const card = K.box({ name: 'Tarjeta', dir: 'v', r: 16, fill: 'fondo/superficie', stroke: 'borde/default', clip: true });
  const tb = K.box({ name: 'Filtros', dir: 'h', pad: 20, gap: 8, stroke: 'borde/default', side: 'bottom' });
  [['Todas', true], ['Pizzas', false], ['Entradas', false], ['Postres', false], ['Bebidas', false]].forEach(c => K.add(tb, K.chip(c[0], c[1])));
  K.add(card, F(tb));
  const rows = PLATOS.filter((p, i) => i < 3 || (i >= 6 && i <= 11)).map(p => {
    const st = K.box({ name: 'disponible', dir: 'h', gap: 8, cross: 'CENTER' });
    K.add(st, K.toggle(p[4]));
    K.add(st, K.text(p[4] ? 'Visible' : 'Oculto', 'bodyS', p[4] ? 'texto/principal' : 'texto/secundario'));
    return [K.stack(p[0], p[2]), p[1], p[3], st, [K.iconButton('Editar'), K.iconButton(p[4] ? 'Ocultar' : 'Mostrar'), K.iconButton('Borrar')]];
  });
  K.add(card, F(K.table([{ h: 'Plato' }, { h: 'Categoría', w: 120 }, { h: 'Precio', w: 110 }, { h: 'Disponible', w: 150 }, { h: 'Acciones', w: 140 }], rows, { bare: true })));
  K.add(a.main, F(card));
  return a.s;
}

// ----- Móvil -----
function scrMInicio(K) {
  const s = screen(K, 'Móvil · Inicio', 390);
  K.add(s, F(K.header({ mobile: true })));
  const hero = K.box({ name: 'Hero', dir: 'v', pad: [32, 16], gap: 16, fill: 'fondo/primario' });
  K.add(hero, K.text('Pizzería en Bucaramanga', 'overline', 'texto/acento-claro'));
  K.add(hero, K.text('Konys Pizza', 'displayM', 'texto/invertido'));
  K.add(hero, F(K.text('La pizza más icónica de la ciudad. Reserva tu mesa en menos de un minuto.', 'body', 'texto/invertido-suave')));
  K.add(hero, F(K.button('Reserva tu mesa', { tipo: 'Acento', icon: 'calendario' })));
  K.add(hero, K.iconText('reloj', '12:30 – 2:30 · 5:00 – 11:00 p. m.', 'texto/invertido-suave'));
  K.add(s, F(hero));
  const sec = K.box({ name: 'Sección mesas', dir: 'v', pad: [32, 16], gap: 16 });
  K.add(sec, K.text('Nuestras mesas', 'h2', 'texto/marca'));
  const chips = K.box({ name: 'filtros', dir: 'h', gap: 8 });
  [['Todas', true], ['Terraza', false], ['Salón', false]].forEach(c => K.add(chips, K.chip(c[0], c[1])));
  K.add(sec, chips);
  MESAS.slice(0, 3).forEach(m => K.add(sec, F(K.mesaCard(m[0], m[1], m[2], m[3]))));
  K.add(sec, F(K.button('Ver todas las mesas', { tipo: 'Secundario' })));
  K.add(s, F(sec));
  K.add(s, F(K.footer({ mobile: true })));
  return s;
}

function scrMReserva(K) {
  const s = screen(K, 'Móvil · Reserva', 390, { fill: 'fondo/superficie' });
  const top = K.box({ name: 'Barra superior', dir: 'h', h: 64, pad: [0, 16], gap: 12, cross: 'CENTER', stroke: 'borde/default', side: 'bottom' });
  K.add(top, K.icon('flecha-izq', 24, 'texto/principal'));
  K.add(top, K.stack('Mesa 3 · Salón', 'Hasta 6 personas'));
  K.add(s, F(top));
  const st = K.box({ name: 'pasos', dir: 'h', pad: [12, 16], fill: 'fondo/sutil' });
  K.add(st, K.steps(3));
  K.add(s, F(st));
  const body = K.box({ name: 'contenido', dir: 'v', pad: [24, 16], gap: 24 });
  const parts = reservaModal(K, { mobile: true });
  K.add(body, F(parts.left));
  K.add(body, F(parts.right));
  K.add(s, F(body));
  return s;
}

function scrMConfirmacion(K) {
  const s = screen(K, 'Móvil · Confirmación', 390);
  K.add(s, F(K.header({ mobile: true })));
  const b = K.box({ name: 'contenido', dir: 'v', pad: [24, 16] });
  K.add(b, F(confirmContent(K, true)));
  K.add(s, F(b));
  return s;
}

function scrMCarta(K) {
  const s = screen(K, 'Móvil · Carta', 390);
  K.add(s, F(K.header({ mobile: true })));
  K.add(s, F(cartaBody(K, true)));
  K.add(s, F(K.footer({ mobile: true })));
  return s;
}

function scrMLogin(K) {
  const s = screen(K, 'Móvil · Admin · Acceso', 390, { h: 844, main: 'CENTER', cross: 'CENTER' });
  const c = K.box({ name: 'Tarjeta de acceso', dir: 'v', w: 358, pad: 24, gap: 20, r: 24, fill: 'fondo/superficie', stroke: 'borde/default', cross: 'CENTER' });
  K.add(c, K.logo(false));
  K.add(c, K.text('Panel de administración', 'h3', 'texto/marca'));
  K.add(c, F(K.input('Contraseña', 'Escribe la contraseña', { value: '••••••••' })));
  K.add(c, F(K.button('Ingresar', { tipo: 'Primario', icon: 'candado' })));
  K.add(s, c);
  return s;
}

const SCREENS = [
  { row: 'Cliente · Escritorio', items: [
    [scrInicio, 'Inicio', 'RF-01 · RF-02 · RF-07 · §11.1'],
    [K => scrReserva(K, false), 'Flujo de reserva', 'RF-02 · RF-03 · RF-04 · RF-05 · CU-02 flujo principal'],
    [K => scrReserva(K, true), 'Reserva · error', 'CU-02 flujo alternativo: slot ocupado y capacidad superada'],
    [scrConfirmacion, 'Confirmación', 'RF-06 · postcondición CU-02'],
    [scrCarta, 'Carta digital', 'RF-07 · CU-03']
  ] },
  { row: 'Cliente · Móvil (mobile first)', items: [
    [scrMInicio, 'Inicio', 'RF-01 · RNF-02'],
    [scrMReserva, 'Reserva', 'RF-03 · RF-04 · RF-05 · grilla de 3 columnas'],
    [scrMConfirmacion, 'Confirmación', 'RF-06'],
    [scrMCarta, 'Carta', 'RF-07'],
    [scrMLogin, 'Admin · Acceso', 'RF-08']
  ] },
  { row: 'Administrador · Escritorio', items: [
    [K => scrLogin(K, false), 'Acceso (/admin)', 'RF-08 · CU-04 · RNF-05'],
    [K => scrLogin(K, true), 'Acceso · error', 'RF-08 contraseña incorrecta'],
    [scrAdminReservas, 'Reservas', 'RF-12 · CU-07'],
    [scrAdminMesas, 'Mesas', 'RF-10 · RF-13 · CU-08'],
    [scrNuevaMesa, 'Nueva mesa', 'RF-09 · CU-05'],
    [scrAdminHorarios, 'Horarios', 'RF-11 · CU-06'],
    [scrAdminCarta, 'Carta', 'RF-14']
  ] }
];

async function buildScreens(K, page, prefix, H) {
  await figma.setCurrentPageAsync(page);
  let y = 0;
  const title = H.text(prefix === 'UI' ? 'Mockups de alta fidelidad' : 'Mockups de baja fidelidad (wireframes)', 'display', 'texto/marca');
  page.appendChild(title); title.x = 0; title.y = y;
  const sub = H.text(prefix === 'UI'
    ? 'Construidos con instancias de los componentes y variables del sistema de diseño. Colores, tipografía e íconos finales.'
    : 'Escala de grises y sin detalles visuales (§11.4): validan la distribución y el flujo antes de escribir código. Mismas pantallas que la versión de alta fidelidad.', 'bodyL', 'texto/secundario', { w: 1200 });
  page.appendChild(sub); sub.x = 0; sub.y = y + 80;
  y += 260;
  for (const row of SCREENS) {
    const rt = H.text(row.row, 'h1', 'texto/marca');
    page.appendChild(rt); rt.x = 0; rt.y = y;
    y += 100;
    let x = 0, maxH = 0;
    for (const it of row.items) {
      const fr = it[0](K);
      fr.name = (prefix === 'UI' ? 'UI · ' : 'Wireframe · ') + fr.name;
      page.appendChild(fr);
      fr.x = x; fr.y = y + 90;
      const lab = H.box({ name: 'Nota · ' + it[1], dir: 'v', gap: 4, w: Math.max(fr.width, 360) });
      H.add(lab, H.text(it[1], 'h3', 'texto/principal'));
      H.add(lab, H.text(it[2], 'bodyS', 'texto/secundario'));
      page.appendChild(lab); lab.x = x; lab.y = y;
      x += fr.width + 120;
      maxH = Math.max(maxH, fr.height);
    }
    y += maxH + 300;
  }
}

function buildCover(H, page) {
  const c = H.box({ name: 'Portada', dir: 'v', w: 1440, h: 900, pad: [96, 120], gap: 32, fill: 'fondo/primario', main: 'SPACE_BETWEEN' });
  const top = H.box({ name: 'superior', dir: 'v', gap: 24 });
  H.add(top, H.logo(true));
  H.add(top, H.text('Sistema de diseño · v1.0', 'overline', 'texto/acento-claro'));
  H.add(top, H.text('Konys Pizza', 'display', 'texto/invertido'));
  H.add(top, H.text('Sistema de Reservas de Mesas', 'h1', 'texto/invertido'));
  H.add(top, H.text('Pizzería Konys · Bucaramanga, Santander', 'bodyL', 'texto/invertido-suave'));
  H.add(c, top);
  const idx = H.box({ name: 'contenido', dir: 'h', gap: 24 });
  [['Sistema de diseño', 'Principios, color, tipografía, espaciado, grillas, íconos, componentes y trazabilidad.'],
    ['Alta fidelidad', '17 pantallas (cliente escritorio, móvil y panel admin) hechas con los componentes.'],
    ['Baja fidelidad', 'Las mismas 17 pantallas como wireframes en escala de grises (§11.4).']].forEach(i => {
    const b = H.box({ name: i[0], dir: 'v', w: 360, pad: 24, gap: 8, r: 16, stroke: 'texto/invertido-suave' });
    H.add(b, H.text(i[0], 'h3', 'texto/acento-claro'));
    H.add(b, F(H.text(i[1], 'bodyS', 'texto/invertido-suave')));
    H.add(idx, b);
  });
  H.add(c, idx);
  H.add(c, H.text('Basado en el documento de proyecto "Konys Pizza – Sistema de Reservas" · Octubre 2026', 'caption', 'texto/invertido-suave'));
  page.appendChild(c);
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------
async function main() {
  figma.notify('Generando el sistema de diseño de Konys Pizza…', { timeout: 4000 });
  await loadFonts();
  createVariables();
  createStyles();

  const cover = figma.root.children[0];
  cover.name = '📘 Portada';
  const dsPage = figma.createPage(); dsPage.name = '🎨 Sistema de diseño';
  const hiPage = figma.createPage(); hiPage.name = '🖥️ Mockups · Alta fidelidad';
  const loPage = figma.createPage(); loPage.name = '✏️ Mockups · Baja fidelidad';

  await figma.setCurrentPageAsync(dsPage);
  const H = makeKit(HIFI);
  const root = H.box({ name: 'Konys Pizza · Sistema de diseño', dir: 'v', w: 1440, pad: 80, gap: 120, fill: 'fondo/pagina' });
  dsPage.appendChild(root);
  buildTokensDoc(H, root);
  buildIcons(H, root);       // a partir de aquí H.icon devuelve instancias
  buildComponents(H, root);  // a partir de aquí cada H.<componente> devuelve instancias
  buildTraceability(H, root);

  const L = makeKit(LOFI);
  await buildScreens(H, hiPage, 'UI', H);
  await buildScreens(L, loPage, 'WF', H);

  await figma.setCurrentPageAsync(cover);
  buildCover(H, cover);

  const res = await Promise.allSettled(PENDING);
  const failed = res.filter(r => r.status === 'rejected').length;
  if (failed) console.warn(failed + ' estilos no se pudieron aplicar');
  figma.viewport.scrollAndZoomIntoView(cover.children);
  figma.closePlugin('✅ Sistema de diseño de Konys Pizza generado' + (DARK_MODE_OK ? '' : ' (modo oscuro omitido: tu plan solo permite 1 modo)'));
}

main().catch(e => {
  console.error(e);
  figma.closePlugin('❌ Error: ' + (e && e.message ? e.message : e));
});
