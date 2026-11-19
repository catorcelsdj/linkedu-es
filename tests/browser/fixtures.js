export const ids = { me: '10000000-0000-4000-8000-000000000001', ana: '10000000-0000-4000-8000-000000000002', pablo: '10000000-0000-4000-8000-000000000003', company: '10000000-0000-4000-8000-000000000004', project: '20000000-0000-4000-8000-000000000001', resource: '30000000-0000-4000-8000-000000000002' }
const timestamp = '2026-11-18T15:00:00+00:00'
export async function mockBackend(page, { signedIn = true, role = 'docente' } = {}) {
  const me = { id: ids.me, role, full_name: 'Lucía Martínez', center: 'IES Sierra Norte', city: 'Madrid', subject_area: 'Ciencias', bio: 'Conecto aulas a través de proyectos de ciencia y sostenibilidad.', education_levels: ['ESO', 'Bachillerato'], website: '', avatar_url: '', social: {}, created_at: timestamp }
  const ana = { ...me, id: ids.ana, role: 'docente', full_name: 'Ana García', subject_area: 'Tecnología', center: 'IES Mediterráneo', city: 'Valencia' }
  const pablo = { ...me, id: ids.pablo, role: 'docente', full_name: 'Pablo Ruiz', subject_area: 'Arte', city: 'Sevilla' }
  const company = { ...me, id: ids.company, role: 'empresa', full_name: 'Robótica Educativa SL', subject_area: '', center: 'Kits de robótica para el aula', city: 'Zaragoza', education_levels: [] }
  const projects = [
    { id: ids.project, owner_id: ids.me, title: 'Un huerto, mil aprendizajes', description: 'Conectamos ciencia, sostenibilidad y creatividad. Un proyecto entre centros para cultivar un futuro mejor.', is_public: true, tags: ['ABP', 'Interdisciplinar'], created_at: timestamp, owner: me, project_members: [{ user_id: ids.me, status: 'aceptado' }, { user_id: ids.ana, status: 'pendiente' }] },
    { id: '20000000-0000-4000-8000-000000000002', owner_id: ids.ana, title: 'Pequeños inventores, grandes ideas', description: 'Un laboratorio de ideas para resolver retos cotidianos con tecnología y mucho ingenio.', is_public: true, tags: ['Arduino', 'Scratch'], created_at: '2026-11-17T10:00:00+00:00', owner: ana, project_members: [] },
  ]
  const resources = [
    { id: '30000000-0000-4000-8000-000000000001', title: 'El aula como laboratorio', description: 'Una guía práctica para despertar la curiosidad científica con materiales cotidianos.', subject_area: 'Ciencias', education_level: 'ESO', resource_type: 'external_link', link_url: 'https://example.org/recurso', owner_id: ids.me, owner: me, created_at: timestamp, tags: ['ABP', 'Docentes'] },
    { id: '30000000-0000-4000-8000-000000000002', title: 'Ideas que se programan', description: 'Retos de pensamiento computacional para crear en equipo.', subject_area: 'Tecnología', education_level: 'Primaria', resource_type: 'file', file_path: `${ids.ana}/retos.pdf`, file_size: 131072, owner_id: ids.ana, owner: ana, created_at: timestamp, tags: ['Scratch'] },
  ]
  const state = { me, people: [me, ana, pablo, company], projects, resources, requests: [], errors: {}, delays: {}, threads: {}, members: null, topics: [] }
  const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: ids.me, role: 'authenticated', exp: 4102444800 }))}.test-signature`
  if (signedIn) await page.addInitScript(({ me, token }) => {
    localStorage.setItem('sb-linkedu-tests-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_at: 4102444800, expires_in: 3600, user: { id: me.id, email: 'lucia@example.org', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } }))
  }, { me, token })
  await page.routeWebSocket('wss://linkedu-tests.supabase.co/**', socket => {
    socket.onMessage(raw => {
      const data = JSON.parse(String(raw))
      const array = Array.isArray(data)
      const [joinRef, ref, topic, event] = array ? data : [null, data.ref, data.topic, data.event]
      if (event === 'phx_join') state.topics.push(topic)
      if (event === 'phx_join' || event === 'heartbeat' || event === 'phx_leave') {
        const payload = { status: 'ok', response: { postgres_changes: [] } }
        socket.send(JSON.stringify(array ? [joinRef, ref, topic, 'phx_reply', payload] : { ref, topic, event: 'phx_reply', payload }))
      }
    })
  })
  await page.route('https://linkedu-tests.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop(), method = request.method()
    state.requests.push({ table, method, url: url.toString(), body: request.postDataJSON() })
    const delay = typeof state.delays[table] === 'function' ? state.delays[table](url) : state.delays[table]
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    if (state.errors[table]) return route.fulfill({ status: 400, json: state.errors[table] })
    const single = request.headers().accept?.includes('application/vnd.pgrst.object')
    const result = rows => route.fulfill({ json: single ? rows[0] || null : rows, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } })
    if (url.pathname.includes('/auth/v1/')) {
      if (table === 'logout') return route.fulfill({ status: 204 })
      if (table === 'user') return route.fulfill({ json: { id: ids.me, email: 'lucia@example.org' } })
      return route.fulfill({ json: { user: { id: ids.me }, session: null } })
    }
    if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': `0-0/${table === 'projects' ? 12 : table === 'resources' ? 48 : table === 'profiles' ? 36 : 2}` } })
    if (table === 'profiles') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (method === 'PATCH') { Object.assign(me, request.postDataJSON()); return result([me]) }
      const role = url.searchParams.get('role')?.replace('eq.', '')
      return result(id ? state.people.filter(person => person.id === id) : state.people.filter(person => !role || person.role === role))
    }
    if (table === 'projects') {
      if (method === 'DELETE') return result([{ id: ids.project }])
      if (method === 'PATCH') { Object.assign(projects[0], request.postDataJSON()); return result([{ id: ids.project }]) }
      const id = url.searchParams.get('id')?.replace('eq.', ''), q = `${url.searchParams.get('or') || ''} ${url.searchParams.get('search') || ''}`
      let rows = id && !id.startsWith('in.') ? projects.filter(project => project.id === id) : projects
      if (q.includes('owner_id.eq')) rows = rows.filter(project => project.owner_id === ids.me || project.project_members.some(member => member.user_id === ids.me))
      if (q.includes('antiguo')) rows = [{ ...projects[0], title: 'Resultado antiguo' }]
      if (q.includes('nuevo')) rows = [{ ...projects[1], title: 'Resultado nuevo' }]
      if (q.includes('inexistente')) rows = []
      return result(rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000)))
    }
    if (table === 'project_members') return result(state.members || [{ id: '40000000-0000-4000-8000-000000000001', user_id: ids.me, status: 'aceptado', profile: me, project_id: ids.project, joined_at: timestamp }, { id: '40000000-0000-4000-8000-000000000002', user_id: ids.ana, status: 'pendiente', profile: ana, project_id: ids.project, joined_at: timestamp }])
    if (table === 'project_posts') return result([{ id: '50000000-0000-4000-8000-000000000001', content: '¡Ya tenemos las primeras semillas! ¿Compartimos los avances esta semana?', author: me, created_at: timestamp }])
    if (table === 'resources') {
      if (method === 'POST') return result([{ ...request.postDataJSON(), id: resources[0].id }])
      if (method === 'DELETE') return result([{ id: resources[0].id }])
      if (method === 'PATCH') { const row = resources.find(r => r.id === url.searchParams.get('id')?.replace('eq.', '')); Object.assign(row, request.postDataJSON()); return result([row]) }
      const id = url.searchParams.get('id')?.replace('eq.', '')
      return result(id ? resources.filter(r => r.id === id) : resources)
    }
    if (table === 'create_project' || table === 'join_project_by_code') return route.fulfill({ json: ids.project })
    if (table === 'project_invite_code') return route.fulfill({ json: 'LK-ABC1234' })
    if (table === 'message_conversations') return result([ana, pablo].map(person => ({ id: person.id, person, unread: person.id === ids.ana ? 2 : 0, last: { sender_id: person.id, receiver_id: ids.me, content: person.id === ids.ana ? '¿Conectamos nuestras aulas?' : 'Tengo una idea para el próximo trimestre.', created_at: timestamp } })))
    if (table === 'messages') {
      if (method === 'PATCH') return route.fulfill({ status: 204 })
      if (method === 'POST') return result([{ ...request.postDataJSON(), id: crypto.randomUUID(), created_at: new Date().toISOString() }])
      const peer = url.searchParams.get('or')?.includes(ids.pablo) ? ids.pablo : ids.ana
      const rows = state.threads[peer] || [{ id: `60000000-0000-4000-8000-${peer === ids.ana ? '000000000001' : '000000000002'}`, sender_id: peer, receiver_id: ids.me, content: peer === ids.ana ? 'Hola, soy Ana' : 'Hola, soy Pablo', created_at: timestamp, read_at: timestamp }]
      const before = url.searchParams.getAll('or')[1]?.match(/created_at.lt.([^,]+)/)?.[1]
      return result(rows.filter(row => !before || row.created_at < before).sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,50))
    }
    return result([])
  })
  return state
}
