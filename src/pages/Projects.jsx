import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { projects } from '../services/api'
import { usePaged, useDebounce } from '../hooks/usePaged'
import { msgError } from '../lib/format'
import { normalizedSearch } from '../lib/validation'
import Icon from '../components/Icon'
import { FormError, LoadMore, PageHead, Status } from '../components/ui'
import ProjectCard from '../components/ProjectCard'
import Modal from '../components/Modal'
import { TagFilter, TagPicker } from '../components/Tags'

function NewProject({ onClose }) {
  const { profile: me } = useAuth(), toast = useToast(), nav = useNavigate()
  const [f, setF] = useState({ title: '', description: '', is_public: true, tags: [] }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setErr('')
    if (f.title.trim().length < 4) return setErr('El título necesita al menos 4 caracteres.')
    setBusy(true)
    try { const p = await projects.create({ ...f, title: f.title.trim(), description: f.description.trim() }, me.id); toast('Proyecto creado'); nav(`/proyectos/${p.id}`) }
    catch (e) { setErr(msgError(e)); setBusy(false) }
  }
  return (
    <Modal title="Nuevo proyecto" onClose={onClose} dismissible={!busy}><form onSubmit={submit}><fieldset disabled={busy}>
      <label className="lbl" htmlFor="t">Título</label><input id="t" className="input" maxLength={100} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
      <label className="lbl" htmlFor="d">¿De qué trata y qué buscas?</label><textarea id="d" rows={4} maxLength={600} className="input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={f.is_public} onChange={e => setF({ ...f, is_public: e.target.checked })} />
        <span><b>Proyecto abierto.</b> Aparece en la lista y cualquiera puede solicitar unirse. Si lo desmarcas, solo entra quien tenga el código.</span></label>
      <TagPicker value={f.tags} onChange={tags => setF({ ...f, tags })} />
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy}>Crear proyecto</button></div>
    </fieldset></form></Modal>
  )
}

function JoinCode({ onClose }) {
  const toast = useToast(), nav = useNavigate()
  const [code, setCode] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try { const id = await projects.joinByCode(code); toast('Te has unido al proyecto'); nav(`/proyectos/${id}`) } catch (e) { setErr(msgError(e)) } finally { setBusy(false) }
  }
  return (
    <Modal title="Unirme con código" onClose={onClose} dismissible={!busy}><form onSubmit={submit}><fieldset disabled={busy}>
      <p className="text-sm text-muted">Te lo da la persona responsable del proyecto. Con él entras sin esperar aprobación.</p>
      <label className="lbl" htmlFor="c">Código</label><input id="c" className="input font-mono uppercase" placeholder="LK-ABC1234" value={code} maxLength={10} required onChange={e => setCode(e.target.value)} autoFocus />
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn">{busy ? 'Entrando…' : 'Unirme'}</button></div>
    </fieldset></form></Modal>
  )
}

export default function Projects() {
  const { profile: me } = useAuth()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(''), [scope, setScope] = useState('all'), [tags, setTags] = useState([]), dq = useDebounce(q)
  const [modal, setModal] = useState(sp.get('nuevo') && me.role === 'docente' ? 'new' : null)
  useEffect(() => { if (sp.get('nuevo') === '1' && me.role === 'docente') setModal('new') }, [sp, me.role])
  const close = () => { setModal(null); setSp({}) }
  const list = usePaged(async (from, to) => {
    if (scope === 'mine') {
      return (await projects.mine(me.id)).filter(p => normalizedSearch(`${p.title || ''} ${p.description || ''}`).includes(normalizedSearch(dq)) && tags.every(t => p.tags?.includes(t))).slice(from, to + 1)
    }
    return projects.list({ q: dq, tags, from, to })
  }, [dq, scope, tags, me.id])

  const empty = dq || tags.length
    ? { icon: 'search', title: 'Ningún proyecto coincide', text: 'Prueba con otras palabras.' }
    : scope === 'mine'
      ? { icon: 'projects', title: 'Aún no participas en ningún proyecto', text: 'Explora los abiertos o entra con el código que te haya dado un docente.', action: { label: 'Ver todos los proyectos', onClick: () => setScope('all') } }
      : { icon: 'projects', title: 'Todavía no hay proyectos', text: me.role === 'docente' ? 'Crea el primero e invita a otros centros a colaborar.' : 'Cuando un docente publique uno, lo verás aquí.', action: me.role === 'docente' ? { label: 'Crear proyecto', onClick: () => setModal('new') } : undefined }
  return (<>
    <PageHead title="Proyectos" sub="Trabajo colaborativo entre centros. Pide unirte a uno abierto o entra con el código que te hayan dado.">
      {me.role !== 'empresa' && <button className="btn btn-s" onClick={() => setModal('code')}>Unirme con código</button>}
      {me.role === 'docente' && <button className="btn" onClick={() => setModal('new')}><Icon name="plus" size={17} />Nuevo proyecto</button>}
    </PageHead>
    <div className="filter-bar">
      <input className="input max-w-xs flex-1" type="search" placeholder="Buscar por título o descripción" aria-label="Buscar proyectos" value={q} onChange={e => setQ(e.target.value)} />
      {me.role !== 'empresa' && <select className="input w-auto" aria-label="Mostrar" value={scope} onChange={e => setScope(e.target.value)}><option value="all">Todos los visibles</option><option value="mine">Solo en los que participo</option></select>}
    </div>
    <TagFilter value={tags} onChange={setTags} />
    <Status loading={list.loading} error={list.error} count={list.items.length} empty={empty} onRetry={list.reload} />
    <div className="grid gap-4 md:grid-cols-2">{list.items.map(p => <ProjectCard key={p.id} p={p} uid={me.id} />)}</div>
    <LoadMore more={list.more} loading={list.loading} onClick={list.loadMore} />
    {modal === 'new' && <NewProject onClose={close} />}
    {modal === 'code' && <JoinCode onClose={close} />}
  </>)
}
