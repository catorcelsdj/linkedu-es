# Arquitectura de Linkedu 5

## Flujo

React → `services/dataApi.js` → Supabase Auth, PostgreSQL + RLS y Storage. No hay backend propio. `api.js` conecta la fábrica de consultas con el cliente real; las pruebas pueden usar un cliente simulado.

Las páginas no implementan consultas SQL. El contexto de autenticación usa la API de perfiles y los datos de sesión de Supabase Auth. El correo de sesión procede de Auth, no del directorio público.

## Integridad de datos y permisos

La migración 004 se aplica tras 001–003, dentro de una transacción. Añade las funciones `create_project`, `project_invite_code`, `message_conversations`, `owns_project` y `can_see_student`; actualiza las políticas afectadas y recarga la caché de PostgREST.

- `create_project` comprueba el rol y genera la invitación con un UUID aleatorio. El trigger `add_project_owner` añade al responsable en la misma transacción. Una reparación inicial cubre proyectos antiguos sin membresía.
- Los listados usan columnas explícitas. Se retira el permiso SELECT general de `profiles` y `projects` y se conceden solo las columnas públicas. No se expone `profiles.email` ni `projects.invite_code`. `project_invite_code` comprueba la participación antes de devolver el código.
- Las funciones SECURITY DEFINER fijan `search_path` y usan `auth.uid()`; los permisos de ejecución públicos se retiran. Las políticas no dependen de datos editables del JWT.
- Solo el responsable acepta o retira miembros. La membresía del responsable no puede eliminarse por la API; el borrado del proyecto sí elimina sus dependencias en cascada.
- El alumnado ve su propio perfil y los de compañeros aceptados. El responsable también ve al alumno que solicita entrar. Una solicitud pendiente no permite consultar al resto del alumnado.
- Los mensajes solo pueden enviarse entre docentes y empresas. Se rechazan mensajes a uno mismo. El receptor solo puede modificar `read_at`; el trigger conserva el resto del mensaje y usa la hora del servidor.
- El correo no es consultable en el directorio. Las columnas `center`, `city`, `education_levels`, `website` y `social` mantienen sus nombres y datos.

## Asincronía

Cada carga de perfil, lista, proyecto y conversación tiene un contador o un indicador de vigencia. Una respuesta de una ruta o filtro anterior se descarta. Los cambios de sesión invalidan el perfil de la persona anterior. Los callbacks de Auth no realizan llamadas asíncronas a Supabase dentro del evento.

`usePaged` conserva el offset real aunque elimine duplicados, impide cargas simultáneas de la misma página, reinicia los resultados al cambiar filtros y permite reintentar. Los fallos no se convierten en listas vacías ni en contadores cero.

Las conversaciones se separan mediante una clave de React por destinatario. La bandeja se calcula en SQL con el último mensaje y el contador completo de cada contacto. El historial ordena por fecha e ID; usa un cursor con ambos campos y recupera 50 mensajes por página. Los eventos y respuestas se fusionan por ID. La caja se bloquea durante el envío para conservar el borrador en caso de error.

`useMessageEvents` usa canales independientes por función, elimina sus listeners al desmontar y añade un sondeo de respaldo de 20 segundos, condicionado a pestaña visible y conexión disponible. Al reconectar se consultan de nuevo los datos. Las lecturas solo se marcan con la pestaña visible.

## Versión 5.1

- Migración 005 (transaccional e idempotente): columna generada `search` con `search_text()` (minúsculas y sin tildes mediante `translate`, sin extensiones) en proyectos, recursos y perfiles; restricciones `NOT VALID` de longitud y de enlaces http(s); `UPDATE` de recursos limitado a las columnas descriptivas; `project_members` y `project_posts` en la publicación de Realtime.
- `dataApi` busca con `ilike` sobre `search` y, si la columna no existe (42703), repite la consulta con el filtro anterior.
- `useRealtime` generaliza la suscripción (tema único por montaje, sondeo opcional). `useMessageEvents` lo usa. El layout escucha solicitudes, aceptaciones y publicaciones (RLS decide qué recibe cada persona) y reenvía un evento `linkedu:project` que refresca el proyecto abierto y el contador de pendientes.
- `usePaged` conserva los resultados (`stale`) durante una recarga y ofrece `remove` y `replace` para cambios locales que mantienen el offset correcto.

## Versión 5.2

- Migración 006: tabla `notifications` (RLS: cada persona lee, marca y borra solo las suyas; sin INSERT desde la API). Disparadores SECURITY DEFINER sobre `messages` (agrupa los mensajes sin leer de una misma persona y marca el aviso al leer la conversación), `project_members` (solicitud, entrada con código, aceptación) y `project_posts` (resto de participantes aceptados). Publicada en Realtime.
- `NotificationBell` consulta el contador y la lista, escucha INSERT/UPDATE de sus avisos y navega con `notificationView()`; los avisos de equipo abren `?tab=personas`.
- `Select` implementa el patrón combobox de solo selección del APG: botón con `role="combobox"`, lista `listbox` con `aria-activedescendant`, sin portal para funcionar dentro de `<dialog>`, y apertura hacia arriba cuando no cabe.

## Storage

Los recursos siguen en un bucket privado, con enlaces firmados de 120 segundos y un máximo de 5 MB. La ventana se abre en el evento de clic, antes de esperar la firma, para evitar que el navegador bloquee la descarga. Se comprueba el protocolo de destino y se desconecta `opener`.

No hay una transacción común entre PostgreSQL y Storage. La subida primero guarda el objeto; si falla el registro, intenta borrarlo y comunica cualquier fallo de compensación. La eliminación primero retira el registro; solo entonces borra el fichero, por lo que un fallo de permisos no deja un recurso visible con el archivo perdido. Si la limpieza falla, se informa de que el registro se retiró y el archivo permanece en Storage para su revisión.

Los avatares se recortan a 256 × 256, con fondo blanco para imágenes transparentes, se convierten a JPEG y liberan el bitmap. El alumnado conserva iniciales. Los fallos al cargar una imagen también muestran iniciales.

## Interfaz

Tokens CSS comunes para ambos temas. Fuente Plus Jakarta Sans incluida mediante Fontsource, sin solicitudes a Google Fonts. Cristal con contraste suficiente, bordes discretos y movimientos contenidos. Las animaciones se desactivan con `prefers-reduced-motion`; el fondo se pausa con la pestaña oculta. El `dialog` nativo aporta foco modal y top layer. Las confirmaciones visuales se resuelven mediante una promesa en `ConfirmProvider`.

## Fuentes técnicas consultadas

- [Eventos de autenticación de Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
- [Permisos por columna](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Límites

La creación de proyectos es atómica. La limpieza de Storage requiere compensaciones y puede dejar archivos huérfanos si también falla esa operación. Las lecturas y restricciones se han comprobado en PostgreSQL local; Auth, SMTP, Storage y Realtime reales requieren una comprobación en la instancia destino. No se añaden servicios ni credenciales de producción.
