// Se ejecuta en Vercel antes de publicar (ver vercel.json).
// Crea js/config.js a partir de las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY,
// para que las credenciales no queden escritas en el repositorio (§14.3).
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('⚠️  Faltan SUPABASE_URL o SUPABASE_ANON_KEY: la app se publicará en modo demostración.');
}

const contenido = '// Archivo generado automáticamente en el despliegue. No editar.\n' +
  'window.KONYS_CONFIG = ' + JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2) + ';\n';

fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), contenido);
console.log('js/config.js generado.');
