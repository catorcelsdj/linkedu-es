export const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')
export function isHttpUrl(value) {
  if (typeof value !== 'string' || /\s/.test(value.trim())) return false
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
  } catch { return false }
}
export const searchTerm = value => String(value || '').normalize('NFC').replace(/[%_(),.*"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
export const normalizedSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
export function mergeMessages(current, incoming) {
  const rows = new Map(current.map(row => [row.id, row]))
  for (const row of incoming) rows.set(row.id, { ...rows.get(row.id), ...row })
  // REST and Realtime may serialise the same instant differently (Z or +00:00): compare instants first.
  const at = row => Date.parse(row.created_at) || 0
  return [...rows.values()].sort((a, b) => at(a) - at(b) || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
}
export const FILE_MIME = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', odt: 'application/vnd.oasis.opendocument.text',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip', txt: 'text/plain',
}
export function validateFile(file) {
  const ext = file?.name?.split('.').pop().toLowerCase()
  if (!file || !FILE_MIME[ext]) throw new Error('Selecciona un fichero en un formato permitido.')
  if (file.size === 0) throw new Error('El fichero está vacío.')
  if (file.size > 5 * 1024 * 1024) throw new Error('El fichero supera los 5 MB.')
  return { ext, contentType: FILE_MIME[ext] }
}
