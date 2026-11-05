# Konys Pizza · Sistema de Reservas de Mesas

App web para reservar mesa en Konys Pizza (Cra. 36 con calle 41, Bucaramanga). El cliente ve qué mesas y horarios están libres y reserva sin llamar. El administrador tiene un panel para manejar mesas, horarios, reservas y la carta.

| | |
|---|---|
| **Aplicación desplegada** | `https://<tu-proyecto>.vercel.app` *(reemplazar)* |
| **Video explicativo** | `https://youtu.be/<id>` *(reemplazar)* |
| **Documento de proyecto** | [docs/Documento-Proyecto.pdf](docs/Documento-Proyecto.pdf) |
| **Sistema de diseño y mockups** | [docs/figma-plugin](docs/figma-plugin) · [docs/mockups](docs/mockups) |

## Funcionalidades

### Cliente (`/`)
- Ver las mesas con su zona (terraza o salón), capacidad y si les queda cupo hoy (RF-01).
- Elegir mesa, fecha y un horario libre (RF-02, RF-03, RF-04).
- Reservar con nombre, número de personas y, si quiere, un teléfono. Son 3 pasos (RF-05, RNF-01).
- Ver el comprobante de la reserva (RF-06).
- Consultar la carta por categorías (RF-07).

### Administrador (`/admin`)
- Entrar con contraseña (RF-08).
- Crear, editar, activar, desactivar y borrar mesas (RF-09, RF-10, RF-13).
- Definir el horario de cada día y cuánto dura una reserva (RF-11).
- Ver las reservas filtrando por fecha, mesa o estado, y cambiarles el estado (RF-12).
- Agregar, editar, ocultar y borrar platos (RF-14).

### Doble reserva (§12.2)
Antes de guardar, la app revisa otra vez que el horario siga libre. Si dos personas confirman al mismo tiempo, la base de datos tiene un índice único que deja pasar solo una.

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5, CSS3 (Flexbox/Grid), JavaScript ES6+ | Interfaz y lógica del cliente, sin frameworks |
| Supabase (PostgreSQL + API REST) | Base de datos, reglas de seguridad (RLS) |
| Vercel | Despliegue continuo desde GitHub |
| Figma | Sistema de diseño y mockups de alta y baja fidelidad |

Son tres capas (§9): la interfaz en HTML y CSS, la lógica en JavaScript dentro del navegador y los datos en Supabase. No hay servidor propio; el JavaScript llama a la API REST de Supabase con `fetch`.

## Estructura

```
konys-reservas-app/
├── index.html            # Página principal (cliente)
├── admin.html            # Panel de administración (/admin)
├── css/styles.css        # Estilos y tokens del sistema de diseño
├── js/
│   ├── config.example.js # Plantilla de credenciales
│   ├── supabase.js       # Conexión con Supabase (y modo demostración)
│   ├── cliente.js        # Lógica del módulo cliente
│   └── admin.js          # Lógica del módulo administrador
├── supabase/esquema.sql  # Tablas, seguridad y datos iniciales
├── scripts/generar-config.js  # Crea js/config.js en Vercel con las variables de entorno
├── tests/
│   ├── e2e.js            # Prueba de punta a punta (Playwright)
│   ├── db-preparar.sql   # Simula los roles de Supabase en PostgreSQL
│   └── db-pruebas.sql    # Prueba seguridad, doble reserva y validaciones
├── .github/workflows/ci.yml   # Integración continua
├── docs/
│   ├── Documento-Proyecto.pdf
│   ├── figma-plugin/     # Genera el sistema de diseño y los mockups en Figma
│   ├── mockups/          # Imágenes de los mockups (alta y baja fidelidad)
│   ├── capturas/         # Capturas de la app funcionando
│   ├── despliegue.md     # Guía paso a paso: Supabase, GitHub y Vercel
│   ├── pruebas.md        # Plan y resultados de pruebas
│   └── guion-video.md    # Guion del video explicativo
├── vercel.json
├── .gitignore
└── README.md
```

## Cómo ejecutarlo

### Opción rápida: modo demostración (sin configurar nada)

Abre `index.html` con un servidor local, por ejemplo con la extensión **Live Server** de VS Code, o con:

```bash
npx serve .
```

Si no hay credenciales de Supabase, la app arranca en modo demostración: trae datos de ejemplo y guarda todo en el navegador. La contraseña del panel en ese modo es `konys2026`.

### Con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta [`supabase/esquema.sql`](supabase/esquema.sql). Antes, cambia la contraseña del administrador en la sección 6 del archivo.
3. Copia `js/config.example.js` como `js/config.js` y escribe la **Project URL** y la **anon public key** (Project Settings → API).
4. Abre la app con un servidor local.

`js/config.js` está en `.gitignore`: las credenciales nunca se suben al repositorio.

### Despliegue en Vercel

Importa el repositorio en Vercel y define las variables de entorno `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Durante el despliegue, `vercel.json` ejecuta `scripts/generar-config.js`, que crea `js/config.js`. La guía completa está en [docs/despliegue.md](docs/despliegue.md).

## Pruebas e integración continua

Cada pull request pasa por GitHub Actions con tres trabajos:

1. Revisión de sintaxis de todo el JavaScript, y de que no haya credenciales en el código.
2. Un PostgreSQL 15 donde se ejecuta `supabase/esquema.sql` y luego `tests/db-pruebas.sql`. Ahí se prueba que el público no lea reservas ajenas, que no se pueda reservar dos veces el mismo horario, que se respete la capacidad y que solo la contraseña correcta permita hacer cambios.
3. La prueba de punta a punta en Chromium (`tests/e2e.js`). Recorre la reserva completa, los errores y el panel de administración, en escritorio y en móvil.

En local:

```bash
npm install
npx playwright install chromium
npm test
```

Para trabajar se crea una rama por cambio (`feat/...`, `fix/...`, `docs/...`) y se abre un pull request hacia `main`. Solo se fusiona cuando el CI está en verde.

## Seguridad

- Todas las tablas tienen Row Level Security. Sin contraseña solo se pueden leer mesas, horarios y platos visibles, y crear reservas.
- Nadie puede leer las reservas de otros. Para saber qué está ocupado, el cliente consulta la vista `slots_ocupados`, que solo tiene mesa, fecha y hora.
- La contraseña del administrador está guardada como hash (bcrypt) en la base de datos. El panel la manda en un encabezado HTTP y Supabase la revisa en cada cambio.
- La capacidad de la mesa y si está activa también se revisan en la base de datos (trigger `validar_reserva`), no solo en el navegador.

## Créditos

Proyecto académico basado en el documento *Konys Pizza – Sistema de Reservas*.
Integrantes: *(escribir los nombres del grupo)*.
