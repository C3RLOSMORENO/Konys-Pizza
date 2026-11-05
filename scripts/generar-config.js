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

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY: la app queda en modo demostración.');
}

const contenido = '// Archivo generado por scripts/generar-config.js. No editar ni subir al repo.\n' +
  'window.KONYS_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2) + ';\n';

fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), contenido);
console.log('js/config.js generado.');
