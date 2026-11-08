# Konys Pizza · Reservas de mesas

App web para reservar mesa en Konys Pizza, la pizzería de pizza en cono de Bucaramanga (sede El Prado, Cra. 36 #38-64). El cliente elige mesa, fecha y hora y queda reservado. El administrador maneja mesas, horarios, reservas y la carta desde `/admin`.

La carta y el horario son los reales de la sede El Prado. Los precios salen de DiDi Food y Rappi (noviembre de 2026). El número de mesas es de ejemplo y se ajusta desde el panel.

Hecha con HTML, CSS y JavaScript, con Supabase como base de datos y desplegada en Vercel.

- App: https://konys-pizza-tau.vercel.app
- Video: _pendiente_

## Correrla en local

Abrir `index.html` con Live Server (o `npx serve .`).

Si no hay credenciales de Supabase, funciona en modo demo: guarda los datos en el navegador y la clave del admin es `konys2026`.

Para conectarla a Supabase:

1. En el SQL Editor de Supabase ejecutar `supabase/esquema.sql`. Si la base ya tenía el esquema con los datos de ejemplo viejos, ejecutar `supabase/datos-reales.sql`, que cambia la carta y el horario por los reales. Si la base ya existía, ejecutar también `supabase/validaciones.sql` y `supabase/seguridad.sql` (se pueden repetir sin problema).
2. Ahí mismo crear la clave del admin (no se guarda en ningún archivo del repo):
   ```sql
   insert into public.ajustes (clave, valor)
   values ('admin_hash', extensions.crypt('TU_CLAVE', extensions.gen_salt('bf')))
   on conflict (clave) do update set valor = excluded.valor;
   ```
3. Copiar `.env.example` como `.env`, poner la Project URL y la anon key, y correr `npm run config`.

`.env` y `js/config.js` están en el `.gitignore`, así que no se suben.

## Validación de datos

Cada campo se valida en tres niveles, con las mismas reglas:

1. **Al escribir** (`js/validacion.js`): los campos numéricos (personas, capacidad, precio, duración) solo dejan escribir dígitos, así que no entran letras, `e`, puntos, comas ni signos. El nombre solo acepta letras, espacios y `' . -`, y el teléfono solo números, espacios y `+ ( ) -`. Si se intenta escribir o pegar otra cosa, aparece un aviso.
2. **Al enviar o salir del campo**: cada valor se revisa completo, por ejemplo personas entre 1 y la capacidad de la mesa, teléfono de Colombia de 10 dígitos (celular 3xx o fijo 60x, con o sin +57), precio entre $100 y $1.000.000, URL de foto `https://`, duración de 15 en 15 minutos y nombres de mesa o plato sin repetir. El error aparece debajo del campo.
3. **En la capa de datos y en la base de datos** (`supabase/validaciones.sql`): aunque alguien se salte la página y mande datos desde la consola o directo a la API de Supabase, la base rechaza cualquier dato mal formado, una reserva fuera del horario de atención o con más de 30 días de anticipación, y el HTML en nombres y descripciones.

## Seguridad

- **Sesión del admin de 10 minutos.** La contraseña se envía una sola vez, al entrar. La base de datos la compara con el hash guardado en `ajustes` y entrega un token aleatorio que vence a los 10 minutos. El navegador guarda solo ese token, nunca la contraseña. El panel muestra la cuenta regresiva, avisa cuando falta un minuto y vuelve a la pantalla de acceso al vencer. La base revisa el vencimiento en cada petición, así que cambiar la hora en el navegador no alarga la sesión. Al cerrar sesión el token deja de servir y se borran de la página los datos de los clientes.
- **Fuerza bruta.** Después de 5 contraseñas incorrectas seguidas, el acceso se bloquea 10 minutos, incluso con la contraseña correcta.
- **Nada sensible en el navegador.** Al inspeccionar la página no aparece ninguna contraseña: el modo demo guarda solo el hash SHA-256 de la clave de prueba. Lo único visible es la URL y la anon key de Supabase, que son públicas por diseño. Los permisos los controlan las reglas de Row Level Security: el público no puede leer reservas, teléfonos, la contraseña ni los tokens de sesión. Si en Vercel se pegara por error la clave secreta (`service_role`), el despliegue se detiene.
- **Solo se publica la web.** Vercel publica la carpeta `publicar/`, que tiene únicamente las páginas, el CSS, el JS y las imágenes. El README, los `.sql`, las pruebas y `package.json` no quedan en internet.
- **Encabezados.** `vercel.json` agrega una Content Security Policy (solo se ejecutan scripts propios de la web), `X-Frame-Options: DENY` para que nadie meta la página dentro de otra, y `no-store` en el admin para que no quede en caché.

## Vercel

Importar el repo y en Settings → Environment Variables pegar el contenido del `.env`. Al desplegar, `scripts/generar-config.js` crea `js/config.js` con esos valores.

## Pruebas

```bash
npm install
npx playwright install chromium
npm test
```

### Pruebas con Selenium e informe

```bash
pip install -r tests/selenium/requirements.txt
npm run test:selenium            # o: python tests/selenium/pruebas.py
```

Recorre toda la web en Chrome con Selenium: el sitio del cliente (mesas, carta, calendario, reserva, validaciones y doble reserva), el panel admin (acceso, reservas, mesas, horarios y carta), la vista en móvil y tablet, la accesibilidad, el SEO, los enlaces, el rendimiento y que no se pueda inyectar HTML. Corre en modo demo, así que no toca Supabase.

Al terminar deja en `informe-selenium/` el informe (`informe.html`, con capturas incluidas), los resultados en `resultados.json` y las capturas sueltas. Opciones: `--ver` muestra la ventana del navegador y `--externos` abre también los enlaces externos.

GitHub Actions corre en cada pull request: revisa la sintaxis, monta el esquema en un Postgres para probar las reglas de seguridad y la doble reserva, y hace la prueba completa del cliente y del admin en Chromium.

## Estructura

```
index.html          página del cliente
admin.html          panel de administración
css/styles.css
js/supabase.js      conexión con Supabase (y modo demo)
js/cliente.js
js/admin.js
supabase/esquema.sql
tests/
docs/               documento del proyecto y plugin de Figma
```

## Integrantes

-
