export const SUBJECTS = ['Matemáticas', 'Tecnología', 'Lengua y Literatura', 'Ciencias', 'Idiomas', 'Historia', 'Informática', 'Arte']
export const LEVELS = ['Infantil', 'Primaria', 'ESO', 'Bachillerato', 'FP', 'Universidad']
export const MAX_FILE = 5 * 1024 * 1024
export const FILE_EXT = ['pdf', 'docx', 'pptx', 'xlsx', 'odt', 'png', 'jpg', 'jpeg', 'zip', 'txt']
export const TAGS = {
  'Categoría': ['ABP', 'Gamificación', 'Evaluación', 'Inclusión', 'Interdisciplinar', 'Orientación', 'Competencia digital'],
  'Tecnología': ['Scratch', 'Python', 'Arduino', 'GeoGebra', 'Canva', 'Moodle', 'Google Workspace', 'Microsoft 365', 'IA generativa', 'Realidad aumentada'],
  'Destinatarios': ['Alumnado', 'Docentes', 'Familias', 'Empresas'],
}
export const MAX_TAGS = 8
export const SOCIALS = [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['x', 'X'], ['instagram', 'Instagram']]
export { isHttpUrl } from './validation.js'
export const UNREAD_EVENT = 'linkedu:unread'
export const PROJECT_EVENT = 'linkedu:project'
// Where each notification leads and how it reads.
export function notificationView(n) {
  const who = n.actor?.full_name || 'Alguien', project = n.project?.title ? `«${n.project.title}»` : 'un proyecto'
  const pid = n.project_id || n.project?.id
  switch (n.type) {
    case 'mensaje': return { icon: 'chat', to: `/mensajes/${n.actor_id || n.actor?.id}`, who, text: n.count > 1 ? `te ha enviado ${n.count} mensajes` : 'te ha enviado un mensaje', preview: n.preview }
    case 'solicitud': return { icon: 'people', to: `/proyectos/${pid}?tab=personas`, who, text: `quiere unirse a ${project}` }
    case 'union': return { icon: 'people', to: `/proyectos/${pid}?tab=personas`, who, text: `se ha unido a ${project}` }
    case 'aceptado': return { icon: 'check', to: `/proyectos/${pid}`, who, text: `te ha aceptado en ${project}` }
    case 'publicacion': return { icon: 'projects', to: `/proyectos/${pid}`, who, text: `ha publicado en ${project}`, preview: n.preview }
    default: return { icon: 'bell', to: '/', who, text: 'tiene novedades para ti' }
  }
}
export const ROLE_LABEL = { docente: 'Docente', alumno: 'Alumno', empresa: 'Empresa' }

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function timeAgo(iso) {
  const s = (new Date(iso) - Date.now()) / 1000, a = Math.abs(s)
  if (!iso || !Number.isFinite(s)) return 'Fecha no disponible'
  // Server time can be slightly ahead of the device clock: a new item is never "in 2 minutes".
  if (a < 45 || s > 0) return 'hace un momento'
  for (const [lim, unit, div] of [[3600, 'minute', 60], [86400, 'hour', 3600], [2592000, 'day', 86400], [31536000, 'month', 2592000], [Infinity, 'year', 31536000]])
    if (a < lim) return rtf.format(Math.round(s / div), unit)
}
export const fullDate = iso => { const d = new Date(iso); return iso && Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'fecha no disponible' }
export const initials = n => (n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
export const fileSize = b => !Number.isFinite(b) || b <= 0 ? 'tamaño desconocido' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'
export const greeting = () => { const h = new Date().getHours(); return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches' }
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

const MAP = [
  ['Invalid login credentials', 'Correo o contraseña incorrectos.'],
  ['User already registered', 'Ya existe una cuenta con ese correo.'],
  ['Email not confirmed', 'Falta confirmar el correo. Revisa tu bandeja de entrada.'],
  ['Password should be at least', 'La contraseña debe tener al menos 6 caracteres.'],
  ['row-level security', 'No tienes permiso para hacer esto.'],
  ['duplicate key', 'Ese elemento ya existe.'],
  ['Failed to fetch', 'No hay conexión con el servidor. Inténtalo de nuevo.'],
  ['rate limit', 'Demasiados intentos seguidos. Espera un minuto.'],
  ['mime type', 'Ese tipo de fichero no está permitido.'],
  ['exceeded the maximum', 'El fichero supera el tamaño máximo (5 MB).'],
]
export const msgError = e => {
  const m = e?.message || String(e || '')
  if (['42703', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e?.code) || /schema cache|column .+ does not exist/.test(m)) return 'La base de datos necesita actualizarse. Aplica las migraciones 001 a 006 indicadas en el README y vuelve a intentarlo.'
  if (e?.code === 'PGRST116') return 'El elemento ya no está disponible o no tienes permiso para modificarlo.'
  if (e?.code === '42501') return 'No tienes permiso para hacer esto. Si acabas de actualizar la app, comprueba las migraciones.'
  if (e?.code === '23505') return 'Ese elemento ya existe o la solicitud ya se ha enviado.'
  if (e?.code === '23514') return 'Revisa los campos: algún dato no cumple los límites permitidos.'
  return (MAP.find(([k]) => m.includes(k)) || [0, m || 'Ha ocurrido un error inesperado.'])[1]
}
