# Linkedu.es · versión 5

Red educativa para docentes, alumnado y empresas. Proyecto completo en React 19, Vite 8, Tailwind CSS 4 y Supabase. Esta entrega aplica la revisión funcional y visual del documento recibido sobre la versión 4.

## Ejecutar

Requisitos: Node.js 22.12 o posterior (recomendado: Node 24) y un proyecto de Supabase.

```sh
npm ci
```

1. Copia `.env.example` a `.env.local` y completa la URL y la clave **pública** de Supabase. Se admite la clave anónima heredada o la clave publishable. Nunca pongas una clave `service_role` o `secret` en Vite.
2. En Supabase → SQL Editor, aplica las migraciones en orden:
   - `supabase/migrations/001_schema_inicial.sql`
   - `supabase/migrations/002_mejoras.sql`
   - `supabase/migrations/003_etiquetas_avatares_realtime.sql`
   - `supabase/migrations/004_estabilidad_y_permisos.sql`
   - `supabase/migrations/005_busqueda_edicion_avisos.sql`
   - `supabase/migrations/006_notificaciones.sql`
3. Si ya tienes aplicadas 001–005, ejecuta **solo 006**. No vuelvas a ejecutar 001 sobre una base de datos existente. 004, 005 y 006 conservan el contenido y pueden repetirse.
4. En Supabase → Authentication → URL Configuration, añade `http://localhost:5173` y tu dominio de producción a las URL autorizadas. Configura también Site URL. La confirmación de cuenta y la recuperación de contraseña dependen de estos ajustes.
5. Inicia:

```sh
npm run dev
```

Sin configuración válida, la aplicación muestra una pantalla de instalación y no intenta conectarse a un servidor ficticio. Si faltan tablas, columnas o funciones, muestra el error y permite reintentar. **La migración 004 es necesaria para esta versión.** Aplica 004 y publica el nuevo frontend juntos: restringe el antiguo `select *` sobre perfiles y proyectos.

## Novedades de la versión 5.2

- **Centro de notificaciones**: campana con contador en la barra superior y panel con mensajes nuevos, solicitudes, entradas con código, aceptaciones y publicaciones de tus proyectos. Cada aviso lleva a su conversación, proyecto o equipo y se marca como leído; también hay «Marcar todas como leídas». Los avisos los crean disparadores en la base de datos (migración 006), se actualizan en tiempo real y los mensajes seguidos de una misma persona se agrupan.
- **Desplegables propios** en filtros y formularios: misma estética que el resto de campos en claro y oscuro, con teclado completo (flechas, Inicio/Fin, escribir para buscar, Escape) y lectores de pantalla.
- **Visibilidad del proyecto** con dos tarjetas grandes, Abierto y Privado, con icono y descripción.
- Selector de tema con la etiqueta «Tema» y buscador de recursos «Buscar por título o descripción».

## Novedades de la versión 5.1

- **Edición** de proyectos (título, descripción, visibilidad y etiquetas) y de recursos (datos descriptivos y enlace; el fichero no se sustituye).
- **Directorio en las dos direcciones**: pestañas Docentes y Empresas (`/docentes?tipo=empresas`).
- **Búsqueda sin tildes ni mayúsculas** en proyectos, recursos y directorio (columna `search` de 005). Sin 005, la búsqueda sigue funcionando como antes.
- **Avisos de proyecto en tiempo real**: solicitudes nuevas, aceptaciones y publicaciones del muro. Contador de solicitudes pendientes en el menú y muro/equipo que se actualizan solos.
- **Retirar una solicitud pendiente** desde el proyecto.
- **Mensajes**: Intro envía y Mayús+Intro añade una línea (con teclado físico; en pantallas táctiles, Intro añade líneas).
- **Enlace directo a cada recurso** (`/recursos?ver=<id>`), con ficha y botón para copiar el enlace. El inicio enlaza al recurso concreto.
- **Listas más fluidas**: al filtrar se mantienen los resultados anteriores atenuados hasta que llegan los nuevos; editar o borrar no recarga la lista ni pierde la posición.
- **Accesibilidad**: al cambiar de página el foco pasa al contenido principal.
- **Tema**: el interruptor muestra un sol en modo claro y una luna en modo oscuro. El nuevo tema se expande en círculo desde el interruptor (View Transitions; cambio instantáneo si el navegador no lo admite o se pide reducir movimiento).
- **Vercel**: cabeceras de seguridad (CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) y caché de un año para `/assets`.

## Qué cambia en la versión 5

- Entrada, panel de inicio, navegación, tarjetas y mensajes con una nueva identidad visual: cristal sutil, verde y azul profundo, fondos con profundidad y una jerarquía más clara. Se conserva el isotipo de Linkedu.
- Temas claro y oscuro coherentes, preferencia del sistema, sincronización entre pestañas, tipografías incluidas en el proyecto y respeto a la reducción de movimiento.
- Modales nativos con foco contenido, retorno al botón de origen, Escape y bloqueo de cierre durante las operaciones. Confirmaciones integradas y controles con etiquetas accesibles.
- Sesiones y perfiles con estados distintos de carga, error y ausencia. Los cambios de ruta o filtros descartan respuestas antiguas.
- Proyectos creados de forma atómica junto con su responsable. Los códigos ya no se incluyen en los listados: solo los participantes pueden recuperarlos. Los códigos antiguos siguen siendo válidos.
- Mensajes recientes primero, historial paginado de 50 en 50, bandeja sin el antiguo recorte a 300 mensajes, fusión sin duplicados y protección contra envíos repetidos. Realtime incluye actualización periódica cada 20 segundos cuando la pestaña es visible.
- Validación de enlaces y archivos, MIME coherente incluso si el navegador no lo detecta, limpieza de subidas fallidas y comunicación de limpiezas incompletas de Storage.
- Perfiles con `center`, `city`, `education_levels`, redes y avatares. Una foto rota muestra las iniciales; una publicación fallida intenta retirar la foto recién subida.
- Permisos SQL más estrictos para invitaciones, correos, perfiles de alumnado y destinatarios de mensajes. La seguridad sigue aplicándose en Supabase, además de los controles de la interfaz.

## Comprobaciones

```sh
npm run lint
npm test
npm run build
# Los tres comandos anteriores:
npm run check
```

Las pruebas de datos usan **PGlite, un PostgreSQL local efímero**. Ejecutan las cuatro migraciones, las repiten donde procede y comprueban RLS, transacciones, privacidad y mensajería. No acceden a tu base de datos.

Pruebas de navegador:

```sh
npx playwright install chromium --only-shell
npm run test:e2e
```

También puedes usar Chrome o Edge instalado mediante `PLAYWRIGHT_CHANNEL=chrome` o `msedge`. En PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. Playwright levanta Vite en el puerto 4173, simula Auth, REST y Realtime, prueba rutas y formularios y verifica accesibilidad con axe. Sus datos son exclusivamente de prueba y **no se incluyen como datos de la aplicación**. `test-results/` contiene las capturas y trazas de la última ejecución.

## Publicar en Vercel

Comando de instalación: `npm ci`. Compilación: `npm run build`. Directorio de salida: `dist`.

La CSP de `vercel.json` permite conexiones a `*.supabase.co`. **Si usas un dominio propio para Supabase**, añádelo a `connect-src` e `img-src` (y a `wss://` en `connect-src`). Si editas el script en línea de `index.html`, actualiza su hash `sha256` en `script-src`: una prueba unitaria avisa si no coinciden.

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel **antes de compilar**. Vite incorpora estas variables al build: cambiarlas requiere una nueva compilación. `vercel.json` mantiene las rutas de la SPA al recargar una página interna.

## Alcance de la entrega

No se han proporcionado credenciales ni acceso a la instancia de Supabase o a Vercel. Esta entrega modifica el código y prepara la migración; **no ha actualizado ni publicado tu servicio real**. Antes de publicar, verifica allí la entrega del correo, Storage y Realtime con dos cuentas de prueba. Las comprobaciones automatizadas no sustituyen esa integración con tus servicios.

El listado de actividad del proyecto muestra las 100 publicaciones más recientes. El perfil público muestra hasta 20 proyectos y 20 recursos. No se incorpora moderación, pagos ni notificaciones fuera de la aplicación.

Más detalles: `docs/ARQUITECTURA.md` y `docs/VERIFICACION.md`.
