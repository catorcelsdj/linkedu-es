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
3. Si ya usabas la versión 4 con las migraciones 001–003 aplicadas, ejecuta **solo 004**. No vuelvas a ejecutar 001 sobre una base de datos existente. 004 conserva el contenido, repara responsables sin membresía y puede repetirse.
4. En Supabase → Authentication → URL Configuration, añade `http://localhost:5173` y tu dominio de producción a las URL autorizadas. Configura también Site URL. La confirmación de cuenta y la recuperación de contraseña dependen de estos ajustes.
5. Inicia:

```sh
npm run dev
```

Sin configuración válida, la aplicación muestra una pantalla de instalación y no intenta conectarse a un servidor ficticio. Si faltan tablas, columnas o funciones, muestra el error y permite reintentar. **La migración 004 es necesaria para esta versión.** Aplica 004 y publica el nuevo frontend juntos: restringe el antiguo `select *` sobre perfiles y proyectos.

## Qué cambia

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

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel **antes de compilar**. Vite incorpora estas variables al build: cambiarlas requiere una nueva compilación. `vercel.json` mantiene las rutas de la SPA al recargar una página interna.

## Alcance de la entrega

No se han proporcionado credenciales ni acceso a la instancia de Supabase o a Vercel. Esta entrega modifica el código y prepara la migración; **no ha actualizado ni publicado tu servicio real**. Antes de publicar, verifica allí la entrega del correo, Storage y Realtime con dos cuentas de prueba. Las comprobaciones automatizadas no sustituyen esa integración con tus servicios.

El listado de actividad del proyecto muestra las 100 publicaciones más recientes. El perfil público muestra hasta 20 proyectos y 20 recursos. No se incorpora moderación, pagos ni notificaciones fuera de la aplicación.

Más detalles: `docs/ARQUITECTURA.md` y `docs/VERIFICACION.md`.
