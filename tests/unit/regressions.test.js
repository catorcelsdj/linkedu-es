import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from '../../src/services/dataApi.js'
import { isHttpUrl, isUuid, searchTerm, mergeMessages, validateFile } from '../../src/lib/validation.js'
import { fileSize, fullDate, msgError, timeAgo } from '../../src/lib/format.js'
const uid = '10000000-0000-4000-8000-000000000001'

test('los enlaces rechazan esquemas ejecutables, credenciales y texto inválido', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'https://user:secret@example.com', 'https://ejemplo.es ruta', 'https://', null]) assert.equal(isHttpUrl(value), false)
  for (const value of ['https://example.org/recurso?x=1', 'http://localhost:5173', 'https://españa.es']) assert.equal(isHttpUrl(value), true)
})
test('los filtros no permiten introducir operadores PostgREST', () => {
  assert.equal(searchTerm('hola%,id.eq.x),*'), 'hola id eq x')
  assert.equal(searchTerm('tecnología y educación'), 'tecnología y educación')
  assert.equal(isUuid(uid), true)
  assert.equal(isUuid('x,or=(id.not.is.null)'), false)
})
test('mensajes de Realtime y respuesta al envío se fusionan sin duplicarse', () => {
  const early = { id: '1', created_at: '2026-01-01T00:00:00Z', content: 'Hola' }
  const late = { id: '2', created_at: '2026-01-02T00:00:00Z', content: 'Respuesta' }
  const merged = mergeMessages([late, early], [{ ...late, read_at: '2026-01-03T00:00:00Z' }])
  assert.deepEqual(merged.map(row => row.id), ['1', '2'])
  assert.ok(merged[1].read_at)
})
test('mensajes con formatos de fecha distintos (REST y Realtime) se ordenan por instante', () => {
  const merged = mergeMessages([{ id: 'b', created_at: '2026-01-01T10:00:00.500+00:00' }], [{ id: 'a', created_at: '2026-01-01T09:59:59Z' }, { id: 'c', created_at: '2026-01-01T11:00:00+01:00' }])
  assert.deepEqual(merged.map(row => row.id), ['a', 'c', 'b'])
})
test('fechas futuras por desfase de reloj, tamaños ausentes y fechas inválidas', () => {
  assert.equal(timeAgo(new Date(Date.now() + 5 * 60000).toISOString()), 'hace un momento')
  assert.equal(fileSize(null), 'tamaño desconocido')
  assert.equal(fileSize(1572864), '1,5 MB')
  assert.equal(fullDate('no-es-fecha'), 'fecha no disponible')
})
test('archivos vacíos, tipos no soportados y límites producen errores útiles', () => {
  assert.throws(() => validateFile({ name: 'a.pdf', size: 0 }), /vacío/)
  assert.throws(() => validateFile({ name: 'a.exe', size: 2 }), /formato/)
  assert.throws(() => validateFile({ name: 'a.pdf', size: 5242881 }), /5 MB/)
  assert.equal(validateFile({ name: 'a.ZIP', size: 5242880 }).contentType, 'application/zip')
})
test('esquema ausente y fechas inválidas no se convierten en pantallas rotas', () => {
  assert.match(msgError({ code: '42703', message: 'column profiles.center does not exist' }), /migraciones 001 a 004/)
  assert.equal(timeAgo('fecha incorrecta'), 'Fecha no disponible')
})
function fakeClient({ insertError, deleteError, storageError } = {}) {
  const events = []
  const storage = { upload: async (...args) => { events.push(['upload', ...args]); return { data: {} } }, remove: async paths => { events.push(['removeFile', paths]); return { data: [], error: storageError } } }
  const query = { select() { return this }, eq() { return this }, single: async () => ({ data: { id: uid }, error: query.deleting ? deleteError : insertError }) }
  return { events, client: { storage: { from: () => storage }, from: () => ({ insert: row => { events.push(['insert', row]); return query }, delete: () => { events.push(['delete']); query.deleting = true; return query } }) } }
}
test('una subida se compensa si falla la publicación del recurso', async () => {
  const { client, events } = fakeClient({ insertError: new Error('fallo DB') })
  await assert.rejects(createApi(client).resources.create({ title: 'Prueba' }, { name: 'a.zip', size: 5, type: '' }, uid), /fallo DB/)
  assert.deepEqual(events.map(row => row[0]), ['upload', 'insert', 'removeFile'])
  assert.equal(events[0][3].contentType, 'application/zip')
})
test('no se borra el fichero si la base de datos rechaza eliminar el recurso', async () => {
  const { client, events } = fakeClient({ deleteError: new Error('sin permiso') })
  await assert.rejects(createApi(client).resources.remove({ id: uid, file_path: 'test.pdf' }), /sin permiso/)
  assert.deepEqual(events.map(row => row[0]), ['delete'])
})
test('una limpieza de Storage fallida se comunica aunque el recurso se haya retirado', async () => {
  const { client } = fakeClient({ storageError: new Error('offline') })
  const result = await createApi(client).resources.remove({ id: uid, file_path: 'test.pdf' })
  assert.match(result.warning, /Storage/)
})
test('un identificador mal formado nunca se envía a la base de datos', async () => {
  const api = createApi(null)
  assert.equal(await api.people.get('bad'), null)
  assert.equal(await api.projects.get('bad'), null)
  await assert.rejects(api.messages.send(uid, uid, 'hola'), /otra persona/)
})
