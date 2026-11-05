# Konys Pizza · Reservas de mesas

App web para reservar mesa en Konys Pizza (Cra. 36 con calle 41, Bucaramanga). El cliente elige mesa, fecha y hora y queda reservado. El administrador maneja mesas, horarios, reservas y la carta desde `/admin`.

Hecha con HTML, CSS y JavaScript, con Supabase como base de datos y desplegada en Vercel.

- App: _pendiente_
- Video: _pendiente_

## Correrla en local

Abrir `index.html` con Live Server (o `npx serve .`).

Si no hay credenciales de Supabase, funciona en modo demo: guarda los datos en el navegador y la clave del admin es `konys2026`.

Para conectarla a Supabase:

1. En el SQL Editor de Supabase ejecutar `supabase/esquema.sql`. Antes, cambiar la clave del admin que está al final del archivo.
2. Copiar `js/config.example.js` como `js/config.js` y poner la Project URL y la anon key.

`js/config.js` está en el `.gitignore`, así que las claves no se suben.

## Vercel

Importar el repo y agregar las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Al desplegar, `scripts/generar-config.js` crea `js/config.js` con esos valores.

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
