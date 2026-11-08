// Crea js/config.js con SUPABASE_URL y SUPABASE_ANON_KEY.
// En Vercel los toma de las variables de entorno del proyecto (ver vercel.json).
// En local los lee del archivo .env (copia .env.example como .env y llénalo), con: npm run config
const fs = require('fs');
const path = require('path');

// Carga .env si existe, sin pisar variables que ya vengan del entorno
const archivoEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(archivoEnv)) {
  fs.readFileSync(archivoEnv, 'utf8').split(/\r?\n/).forEach(linea => {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

// Acepta la URL con o sin "/rest/v1/" al final (la app agrega esa parte sola)
const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

// La clave secreta (service_role / sb_secret_) salta todas las reglas de seguridad: jamás debe llegar al navegador
function esClaveSecreta(k) {
  if (/^sb_secret_/.test(k)) return true;
  const partes = k.split('.');
  if (partes.length !== 3) return false;
  try { return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role === 'service_role'; } catch (e) { return false; }
}
if (key && esClaveSecreta(key)) {
  console.error('❌ SUPABASE_ANON_KEY tiene la clave secreta (service_role). Usa la anon / publishable key: la secreta daría acceso total a la base de datos.');
  process.exit(1);
}

if (!url || !key) {
  console.warn('⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY: la app queda en modo demostración.');
}

const contenido = '// Archivo generado por scripts/generar-config.js. No editar ni subir al repo.\n' +
  'window.KONYS_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2) + ';\n';

fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), contenido);
console.log('js/config.js generado.');

// Con --publicar (lo usa Vercel) se arma la carpeta publicar/ solo con los archivos de la web.
// Así no quedan visibles en internet el README, los .sql, las pruebas ni package.json.
if (process.argv.includes('--publicar')) {
  const raiz = path.join(__dirname, '..');
  const destino = path.join(raiz, 'publicar');
  fs.rmSync(destino, { recursive: true, force: true });
  const copiar = (rel, filtro) => {
    const origen = path.join(raiz, rel);
    if (fs.statSync(origen).isDirectory()) {
      fs.readdirSync(origen).forEach(f => copiar(path.join(rel, f), filtro));
    } else if (!filtro || filtro(rel)) {
      fs.mkdirSync(path.dirname(path.join(destino, rel)), { recursive: true });
      fs.copyFileSync(origen, path.join(destino, rel));
    }
  };
  copiar('index.html');
  copiar('admin.html');
  copiar('css', f => f.endsWith('.css'));
  copiar('js', f => f.endsWith('.js') && !f.endsWith('config.example.js'));
  copiar('img', f => /\.(jpe?g|png|webp|svg)$/i.test(f));
  console.log('Carpeta publicar/ lista.');
}
