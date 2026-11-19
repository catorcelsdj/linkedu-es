import { isHttpUrl, isUuid, searchTerm, validateFile } from '../lib/validation.js'

export const PROFILE = 'id,role,full_name,subject_area,bio,avatar_url,center,city,education_levels,website,social,created_at'
const PROJ = 'id,owner_id,title,description,is_public,tags,created_at,owner:profiles!owner_id(id,full_name,subject_area,avatar_url),project_members(user_id,status)'
const RESOURCE = '*,owner:profiles!owner_id(id,full_name,avatar_url)'
const ok = result => { if (result.error) throw result.error; return result.data }
const requireId = id => { if (!isUuid(id)) throw new Error('La dirección no es válida.'); return id }
const match = (query, q, columns) => {
  const term = searchTerm(q)
  return term ? query.or(columns.map(column => `${column}.ilike.%${term}%`).join(',')) : query
}
const text = (value, min, max, label) => {
  const v = String(value || '').trim()
  if (v.length < min || v.length > max) throw new Error(`${label}: usa entre ${min} y ${max} caracteres.`)
  return v
}

// The factory also allows regression tests without real accounts or data.
export function createApi(sb) {
  const projects = {
    list: async ({ q, tags, owner, from = 0, to = 11 } = {}) => {
      let query = match(sb.from('projects').select(PROJ), q, ['title', 'description'])
      if (tags?.length) query = query.contains('tags', tags)
      if (owner) query = query.eq('owner_id', requireId(owner))
      return ok(await query.order('created_at', { ascending: false }).order('id').range(from, to)) || []
    },
    mine: async uid => {
      requireId(uid)
      const ids = ok(await sb.from('project_members').select('project_id').eq('user_id', uid)).map(m => m.project_id)
      const filter = ids.length ? `owner_id.eq.${uid},id.in.(${ids.join(',')})` : `owner_id.eq.${uid}`
      return ok(await sb.from('projects').select(PROJ).or(filter).order('created_at', { ascending: false }).order('id')) || []
    },
    get: async id => isUuid(id) ? ok(await sb.from('projects').select(PROJ).eq('id', id).maybeSingle()) : null,
    create: async p => {
      const id = ok(await sb.rpc('create_project', {
        project_title: text(p.title, 4, 100, 'Título'), project_description: String(p.description || '').trim(),
        project_public: !!p.is_public, project_tags: p.tags || [],
      }))
      return { id }
    },
    invite: async id => ok(await sb.rpc('project_invite_code', { pid: requireId(id) })),
    request: async (pid, uid) => ok(await sb.from('project_members').insert({ project_id: requireId(pid), user_id: requireId(uid), status: 'pendiente' })),
    joinByCode: async code => {
      const value = String(code || '').trim().toUpperCase()
      if (!/^LK-[A-Z0-9]{4,7}$/.test(value)) throw new Error('Introduce un código válido, por ejemplo LK-ABC1234.')
      return ok(await sb.rpc('join_project_by_code', { code: value }))
    },
    members: async pid => ok(await sb.from('project_members').select('id,user_id,status,joined_at,profile:profiles!user_id(id,full_name,role,subject_area,avatar_url)').eq('project_id', requireId(pid)).order('joined_at')) || [],
    accept: async id => ok(await sb.from('project_members').update({ status: 'aceptado' }).eq('id', requireId(id)).select('id').single()),
    removeMember: async id => ok(await sb.from('project_members').delete().eq('id', requireId(id)).select('id').single()),
    remove: async id => ok(await sb.from('projects').delete().eq('id', requireId(id)).select('id').single()),
    posts: async pid => ok(await sb.from('project_posts').select('id,content,created_at,author:profiles!author_id(id,full_name,role,avatar_url)').eq('project_id', requireId(pid)).order('created_at', { ascending: false }).limit(100)) || [],
    addPost: async (pid, uid, content) => ok(await sb.from('project_posts').insert({ project_id: requireId(pid), author_id: requireId(uid), content: text(content, 1, 2000, 'Publicación') })),
    removePost: async id => ok(await sb.from('project_posts').delete().eq('id', requireId(id)).select('id').single()),
  }
  const resources = {
    list: async ({ q, subject, level, tags, owner, from = 0, to = 11 } = {}) => {
      let query = match(sb.from('resources').select(RESOURCE), q, ['title', 'description'])
      if (subject) query = query.eq('subject_area', subject)
      if (level) query = query.eq('education_level', level)
      if (tags?.length) query = query.contains('tags', tags)
      if (owner) query = query.eq('owner_id', requireId(owner))
      return ok(await query.order('created_at', { ascending: false }).order('id').range(from, to)) || []
    },
    create: async (meta, file, uid) => {
      let row = { ...meta, title: text(meta.title, 3, 120, 'Título'), owner_id: requireId(uid), resource_type: file ? 'file' : 'external_link' }
      let path
      if (file) {
        const { ext, contentType } = validateFile(file)
        path = `${uid}/${crypto.randomUUID()}.${ext}`
        ok(await sb.storage.from('resources').upload(path, file, { contentType }))
        row = { ...row, file_path: path, file_size: file.size, link_url: null }
      } else {
        if (!isHttpUrl(meta.link_url)) throw new Error('El enlace debe ser una dirección http:// o https:// válida.')
        row.link_url = meta.link_url.trim()
      }
      try { return ok(await sb.from('resources').insert(row).select().single()) }
      catch (error) {
        if (path) {
          try { ok(await sb.storage.from('resources').remove([path])) }
          catch { throw new Error('No se pudo publicar ni limpiar el fichero subido. Revisa Storage antes de volver a subirlo.', { cause: error }) }
        }
        throw error
      }
    },
    remove: async r => {
      // A failed database deletion must not break a download that is still visible.
      ok(await sb.from('resources').delete().eq('id', requireId(r.id)).select('id').single())
      if (r.file_path) {
        try { ok(await sb.storage.from('resources').remove([r.file_path])) }
        catch { return { warning: 'El recurso se ha retirado. No se pudo eliminar su fichero de Storage.' } }
      }
      return {}
    },
    url: async r => {
      const url = r.file_path ? ok(await sb.storage.from('resources').createSignedUrl(r.file_path, 120)).signedUrl : r.link_url
      if (!isHttpUrl(url)) throw new Error('Este recurso no tiene un enlace válido.')
      return url
    },
  }
  const people = {
    teachers: async ({ q, subject, level, from = 0, to = 11 } = {}) => {
      let query = match(sb.from('profiles').select(PROFILE).eq('role', 'docente'), q, ['full_name', 'bio', 'center', 'city'])
      if (subject) query = query.eq('subject_area', subject)
      if (level) query = query.contains('education_levels', [level])
      return ok(await query.order('full_name').order('id').range(from, to)) || []
    },
    get: async id => isUuid(id) ? ok(await sb.from('profiles').select(PROFILE).eq('id', id).maybeSingle()) : null,
    update: async (uid, patch) => ok(await sb.from('profiles').update(patch).eq('id', requireId(uid)).select(PROFILE).single()),
    byIds: async ids => ids.length ? ok(await sb.from('profiles').select('id,full_name,role,subject_area,avatar_url').in('id', ids.map(requireId))) : [],
  }
  const messages = {
    conversations: async () => ok(await sb.rpc('message_conversations')) || [],
    thread: async (uid, other, before) => {
      requireId(uid); requireId(other)
      let query = sb.from('messages').select('*').or(`and(sender_id.eq.${uid},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${uid})`)
      if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${requireId(before.id)})`)
      return (ok(await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)) || []).reverse()
    },
    send: async (uid, to, content) => {
      requireId(uid); requireId(to)
      if (uid === to) throw new Error('Elige otra persona para conversar.')
      return ok(await sb.from('messages').insert({ sender_id: uid, receiver_id: to, content: text(content, 1, 2000, 'Mensaje') }).select().single())
    },
    markRead: async (uid, other) => ok(await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('receiver_id', requireId(uid)).eq('sender_id', requireId(other)).is('read_at', null)),
    unread: async uid => {
      const result = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', requireId(uid)).is('read_at', null)
      ok(result); return result.count || 0
    },
  }
  const avatars = {
    upload: async (uid, blob) => {
      const path = `${requireId(uid)}/avatar-${crypto.randomUUID()}.jpg`
      ok(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }))
      return { path, url: sb.storage.from('avatars').getPublicUrl(path).data.publicUrl }
    },
    remove: async url => {
      const match = (url || '').match(/\/storage\/v1\/object\/public\/avatars\/([^?#]+)$/)
      if (match) ok(await sb.storage.from('avatars').remove([decodeURIComponent(match[1])]))
    },
  }
  const stats = async () => {
    const count = async query => { const result = await query; ok(result); return result.count || 0 }
    const [p, r, d] = await Promise.allSettled([
      count(sb.from('projects').select('id', { count: 'exact', head: true })),
      count(sb.from('resources').select('id', { count: 'exact', head: true })),
      count(sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'docente')),
    ])
    const value = result => result.status === 'fulfilled' ? result.value : null
    return { projects: value(p), resources: value(r), teachers: value(d) }
  }
  return { projects, resources, people, messages, avatars, stats }
}
