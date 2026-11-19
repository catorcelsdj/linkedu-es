# Verificación de Linkedu 5

Comprobaciones realizadas el 19 de noviembre de 2026, sobre el código entregado.

| Comprobación | Resultado |
| --- | --- |
| ESLint (`npm run lint`, máximo 0 avisos) | Correcto: 0 errores y 0 avisos |
| Pruebas de lógica y PostgreSQL (`npm test`) | 16 aprobadas, 0 fallidas |
| Pruebas de navegador (`npm run test:e2e`) | 11 aprobadas, 0 fallidas, 0 omitidas, 0 reintentos |
| Compilación de producción (`npm run build`) | Correcta, sin avisos de Vite |
| Manifiesto y lockfile | Versiones y dependencias coinciden |

## Qué se ha comprobado

- Instalación de las cuatro migraciones en PostgreSQL efímero (PGlite). La migración 004 se repitió sin errores y sin duplicar al responsable.
- Creación atómica de proyectos y acceso al muro del responsable; protección de los códigos y correos frente a SELECT directo; restricciones del alumnado y empresas; mensajes solo entre destinatarios permitidos.
- Bandeja con más de 300 mensajes: conserva los contactos antiguos y cuenta los mensajes no leídos.
- Validación de enlaces, archivos vacíos o excesivos, formatos y compensación de subidas fallidas.
- Registro, recuperación de acceso, selección de rol, persistencia del tema y validación de formularios.
- Error de columnas de perfil ausentes: se muestra una explicación con reintento, en lugar de llevar al acceso o mostrar una pantalla vacía.
- Inicio, proyectos, detalle de proyecto, recursos, directorio, perfil público, ajustes y mensajes: navegación sin excepciones ni avisos de consola en el recorrido correcto.
- Modal de creación: foco contenido, cierre con Escape, devolución del foco, creación y navegación al resultado.
- Búsquedas rápidas y conversaciones: las respuestas tardías no sustituyen el resultado actual. Ctrl+Intro repetido no duplica un envío. Historial de 260 mensajes con carga de páginas anteriores.
- Recursos y cambio de contraseña: los errores dejan controles utilizables y permiten reintentar.
- Ruta de mensajes del alumnado: redirige a inicio sin consultar mensajes.
- Ancho móvil de 390 px: vistas sin desbordamiento horizontal del documento y respeto de `prefers-reduced-motion`.
- axe con reglas WCAG 2 A/AA y 2.1 AA: 0 infracciones detectadas en el recorrido de vistas en claro, el acceso y el inicio en ambos temas, el modal y el inicio móvil oscuro. Es una comprobación automática, no una certificación de accesibilidad.

## Capturas

Las capturas incluidas en `docs/capturas/` se han revisado visualmente. Representan el código real con datos simulados de las pruebas, no datos de tu comunidad:

- `acceso-claro.png`, `acceso-oscuro.png`
- `inicio-claro.png`, `inicio-oscuro.png`, `inicio-movil.png`
- `proyectos.png`

## Entorno y alcance

Node.js 24.21.0, React 19.3.1, Vite 8.3.6 y Playwright 1.65.1 con Google Chrome instalado. Se usó un servidor Vite local separado para que el entorno aislado pudiera finalizar limpiamente la ejecución del navegador (`LINKEDU_TEST_EXTERNAL_SERVER=1`). Las pruebas también pueden iniciar Vite automáticamente mediante el comando documentado en el README.

Los tests de navegador interceptan las peticiones a una URL ficticia de Supabase. Los tests SQL usan roles y esquemas locales equivalentes para probar las migraciones; no conectan con un proyecto de Supabase real. No se han verificado con servicios reales el correo de confirmación/recuperación, Storage ni la entrega de eventos Realtime entre dispositivos.

No se han aplicado migraciones ni desplegado cambios en producción. Hace falta configurar `.env.local` y aplicar la migración 004 (tras 001–003) en tu instancia, tal como explica el README.
