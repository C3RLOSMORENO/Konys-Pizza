# Konys Pizza · Reservas de mesas

App web para reservar mesa en Konys Pizza, la pizzería de pizza en cono de Bucaramanga (sede El Prado, Cra. 36 #38-64). El cliente elige mesa, fecha y hora y queda reservado. El administrador maneja mesas, horarios, reservas y la carta desde `/admin`.

La carta y el horario son los reales de la sede El Prado. Los precios salen de DiDi Food y Rappi (noviembre de 2026). El número de mesas es de ejemplo y se ajusta desde el panel.

Hecha con HTML, CSS y JavaScript, con Supabase como base de datos y desplegada en Vercel.

- App: _pendiente_
- Video: _pendiente_

## Correrla en local

Abrir `index.html` con Live Server (o `npx serve .`).

Si no hay credenciales de Supabase, funciona en modo demo: guarda los datos en el navegador y la clave del admin es `konys2026`.

Para conectarla a Supabase:

1. En el SQL Editor de Supabase ejecutar `supabase/esquema.sql`. Si la base ya tenía el esquema con los datos de ejemplo viejos, ejecutar `supabase/datos-reales.sql`, que cambia la carta y el horario por los reales.
2. Ahí mismo crear la clave del admin (no se guarda en ningún archivo del repo):
   ```sql
   insert into public.ajustes (clave, valor)
   values ('admin_hash', extensions.crypt('TU_CLAVE', extensions.gen_salt('bf')))
   on conflict (clave) do update set valor = excluded.valor;
   ```
3. Copiar `.env.example` como `.env`, poner la Project URL y la anon key, y correr `npm run config`.

`.env` y `js/config.js` están en el `.gitignore`, así que no se suben.

## Vercel

Importar el repo y en Settings → Environment Variables pegar el contenido del `.env`. Al desplegar, `scripts/generar-config.js` crea `js/config.js` con esos valores.

## Pruebas

```bash
npm install
npx playwright install chromium
npm test
```

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
