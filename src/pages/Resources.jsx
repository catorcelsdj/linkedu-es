import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { resources } from '../services/api'
import { usePaged, useDebounce } from '../hooks/usePaged'
import { FILE_EXT, LEVELS, MAX_FILE, SUBJECTS, fileSize, fullDate, isHttpUrl, msgError } from '../lib/format'
import { useConfirm } from '../context/ConfirmContext'
import { openResource } from '../lib/openResource'
import Icon from '../components/Icon'
import Select from '../components/Select'
import { FormError, LoadMore, LoadingState, PageHead, Status } from '../components/ui'
import ResourceCard, { resourceLink } from '../components/ResourceCard'
import Modal from '../components/Modal'
import { TagFilter, TagList, TagPicker } from '../components/Tags'

// Shares a resource, or edits its details when `resource` is given. The file itself cannot be replaced.
function ResourceForm({ resource, onClose, onDone }) {
  const { profile: me } = useAuth(), toast = useToast()
  const editing = !!resource
  const [kind, setKind] = useState(resource ? (resource.resource_type === 'file' ? 'file' : 'link') : 'link'), [file, setFile] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [f, setF] = useState({ title: resource?.title || '', description: resource?.description || '', subject_area: resource?.subject_area || me.subject_area || '', education_level: resource?.education_level || '', link_url: resource?.link_url || '', tags: resource?.tags || [] })
  const set = k => e => setF({ ...f, [k]: e.target.value })

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (busy) return
    if (f.title.trim().length < 3) return setErr('El título necesita al menos 3 caracteres.')
    if (!f.subject_area) return setErr('Elige una asignatura.')
    if (kind === 'link' && !isHttpUrl(f.link_url.trim())) return setErr('El enlace debe ser una dirección http:// o https:// válida.')
    if (kind === 'file' && !editing) {
      if (!file) return setErr('Elige un fichero.')
      if (!FILE_EXT.includes(file.name.split('.').pop().toLowerCase())) return setErr(`Formatos permitidos: ${FILE_EXT.join(', ')}.`)
      if (file.size > MAX_FILE) return setErr('El fichero supera los 5 MB. Súbelo a Drive u OneDrive y comparte el enlace.')
    }
    setBusy(true)
    try {
      const meta = { title: f.title.trim(), description: f.description.trim(), subject_area: f.subject_area, education_level: f.education_level, tags: f.tags }
      const row = editing
        ? await resources.update(resource, kind === 'link' ? { ...meta, link_url: f.link_url.trim() } : meta)
        : await resources.create(kind === 'link' ? { ...meta, link_url: f.link_url.trim() } : meta, kind === 'file' ? file : null, me.id)
      toast(editing ? 'Recurso actualizado' : 'Recurso publicado'); onDone(row)
    } catch (e) { setErr(msgError(e)); setBusy(false) }
  }
  return (
    <Modal title={editing ? 'Editar recurso' : 'Compartir recurso'} onClose={onClose} dismissible={!busy}><form onSubmit={submit}><fieldset disabled={busy}>
      {!editing && <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="group" aria-label="Tipo de recurso">
        {[['link', 'Enlace externo'], ['file', 'Fichero (hasta 5 MB)']].map(([k, l]) => <button type="button" aria-pressed={kind === k} key={k} onClick={() => setKind(k)} className={`flex-1 cursor-pointer rounded-lg py-1.5 ${kind === k ? 'bg-surface text-navy' : 'text-muted'}`}>{l}</button>)}
      </div>}
      <label className="lbl" htmlFor="rt">Título</label><input id="rt" className="input" maxLength={120} value={f.title} onChange={set('title')} autoFocus />
      <label className="lbl" htmlFor="rd">Descripción</label><textarea id="rd" rows={3} maxLength={500} className="input" placeholder="Para qué curso sirve y cómo usarlo" value={f.description} onChange={set('description')} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="lbl" htmlFor="rs">Asignatura</label><Select id="rs" value={f.subject_area} onChange={v => setF({ ...f, subject_area: v })} options={[['', 'Elige una'], ...SUBJECTS, ...(f.subject_area && !SUBJECTS.includes(f.subject_area) ? [f.subject_area] : [])]} /></div>
        <div><label className="lbl" htmlFor="rl">Etapa</label><Select id="rl" value={f.education_level} onChange={v => setF({ ...f, education_level: v })} options={[['', 'Cualquiera'], ...LEVELS]} /></div>
      </div>
      {kind === 'link'
        ? (<><label className="lbl" htmlFor="ru">Enlace</label><input id="ru" className="input" placeholder="https://" value={f.link_url} onChange={set('link_url')} /></>)
        : editing
          ? <p className="hint mt-4">El fichero no se puede sustituir. Si necesitas otra versión, publica un recurso nuevo y elimina este.</p>
          : (<><label className="lbl" htmlFor="rf">Fichero</label><input id="rf" type="file" className="input" accept={FILE_EXT.map(x => '.' + x).join(',')} onChange={e => setFile(e.target.files[0] || null)} /><p className="hint">Formatos: {FILE_EXT.join(', ')}.</p></>)}
      <TagPicker value={f.tags} onChange={tags => setF({ ...f, tags })} />
      <p className="hint mt-3">Los recursos los ve cualquier persona con cuenta. No subas datos personales del alumnado.</p>
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy}>{busy ? (editing ? 'Guardando…' : 'Publicando…') : editing ? 'Guardar cambios' : 'Publicar'}</button></div>
    </fieldset></form></Modal>
  )
}

// Resource sheet opened from a direct link (/recursos?ver=<id>), so a resource can be shared or bookmarked.
function ResourceView({ id, known, uid, onClose, onOpen, onEdit, onDelete }) {
  const toast = useToast()
  const [r, setR] = useState(known || undefined), [error, setError] = useState('')
  useEffect(() => {
    if (known) { setR(known); return }
    let off = false
    setR(undefined); setError('')
    resources.get(id).then(row => { if (!off) setR(row) }).catch(e => { if (!off) setError(msgError(e)) })
    return () => { off = true }
  }, [id, known])
  const copy = async () => {
    try { await navigator.clipboard.writeText(new URL(resourceLink(id), window.location.origin).href); toast('Enlace copiado') }
    catch { toast('No se pudo copiar. Copia la dirección desde la barra del navegador.', 'info') }
  }
  return <Modal title={r?.title || 'Recurso'} onClose={onClose}>
    {error ? <FormError>{error}</FormError> : r === undefined ? <LoadingState /> : r === null ? <p className="mt-3 text-sm text-muted">Este recurso ya no está disponible.</p> : <>
      <p className="mt-2 text-xs text-muted">Por {r.owner ? <Link className="hover:underline" to={`/docentes/${r.owner.id}`}>{r.owner.full_name}</Link> : 'La comunidad'}, el {fullDate(r.created_at)}</p>
      {r.description && <p className="mt-4 whitespace-pre-wrap text-sm">{r.description}</p>}
      <div className="mt-4 flex flex-wrap gap-1"><span className="chip">{r.subject_area}</span>{r.education_level && <span className="chip">{r.education_level}</span>}<span className="chip">{r.resource_type === 'file' ? `Fichero, ${fileSize(r.file_size)}` : 'Enlace'}</span></div>
      <TagList tags={r.tags} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn" onClick={() => onOpen(r)}>{r.resource_type === 'file' ? 'Descargar' : 'Abrir recurso'}<Icon name="arrow" size={16} /></button>
        <button className="btn btn-s" onClick={copy}><Icon name="copy" size={16} />Copiar enlace</button>
        {r.owner_id === uid && <><button className="link text-sm" onClick={() => onEdit(r)}>Editar</button><button className="danger" onClick={() => onDelete(r)}>Eliminar</button></>}
      </div>
    </>}
  </Modal>
}

export default function Resources() {
  const { profile: me } = useAuth(), toast = useToast()
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(null), [editing, setEditing] = useState(null), [revision, setRevision] = useState(0)
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(''), [subject, setSubject] = useState(''), [level, setLevel] = useState(''), [tags, setTags] = useState([]), dq = useDebounce(q)
  const [open, setOpen] = useState(!!sp.get('nuevo') && me.role === 'docente')
  const viewing = sp.get('ver')
  useEffect(() => { if (sp.get('nuevo') === '1' && me.role === 'docente') setOpen(true) }, [sp, me.role])
  const list = usePaged((from, to) => resources.list({ q: dq, subject, level, tags, from, to }), [dq, subject, level, tags])
  const close = () => { setOpen(false); setSp({}) }
  const closeView = () => setSp(params => { params.delete('ver'); return params })

  const openRes = async r => { try { await openResource(r) } catch (e) { toast(msgError(e), 'error') } }
  const del = async r => {
    if (deleting || !await confirm(`¿Eliminar «${r.title}»? Esta acción no se puede deshacer.`, 'Eliminar recurso')) return
    setDeleting(r.id)
    try {
      const result = await resources.remove(r)
      toast(result.warning || 'Recurso eliminado', result.warning ? 'info' : 'ok')
      list.remove(r.id)
      if (viewing === r.id) closeView()
    } catch (e) { toast(msgError(e), 'error') } finally { setDeleting(null) }
  }
  const empty = dq || subject || level || tags.length
    ? { icon: 'search', title: 'Ningún recurso con esos filtros', text: 'Prueba a quitar la asignatura o la etapa.' }
    : { icon: 'resources', title: 'El banco está vacío', text: me.role === 'docente' ? 'Comparte tu primer material de aula: un enlace o un fichero.' : 'Cuando los docentes compartan material, aparecerá aquí.', action: me.role === 'docente' ? { label: 'Compartir recurso', onClick: () => setOpen(true) } : undefined }
  return (<>
    <PageHead title="Banco de recursos" sub="Material de aula compartido por docentes, ordenado por asignatura y etapa.">
      {me.role === 'docente' && <button className="btn" onClick={() => setOpen(true)}><Icon name="plus" size={17} />Compartir recurso</button>}
    </PageHead>
    <div className="filter-bar">
      <input className="input max-w-xs flex-1" type="search" placeholder="Buscar por título o descripción" aria-label="Buscar recursos" value={q} onChange={e => setQ(e.target.value)} />
      <Select className="w-auto" ariaLabel="Asignatura" value={subject} onChange={setSubject} options={[['', 'Todas las asignaturas'], ...SUBJECTS]} />
      <Select className="w-auto" ariaLabel="Etapa" value={level} onChange={setLevel} options={[['', 'Todas las etapas'], ...LEVELS]} />
    </div>
    <TagFilter value={tags} onChange={setTags} />
    <Status loading={list.loading} error={list.error} count={list.items.length} empty={empty} onRetry={list.reload} />
    <div className="results grid gap-4 md:grid-cols-2" aria-busy={list.stale}>{list.items.map(r => <ResourceCard key={r.id} r={r} uid={me.id} onOpen={openRes} onDelete={del} onEdit={setEditing} busy={!!deleting} />)}</div>
    <LoadMore more={list.more} loading={list.loading} onClick={list.loadMore} />
    {open && <ResourceForm onClose={close} onDone={() => { close(); list.reload() }} />}
    {viewing && !editing && <ResourceView key={`${viewing}:${revision}`} id={viewing} known={list.items.find(r => r.id === viewing)} uid={me.id} onClose={closeView} onOpen={openRes} onEdit={setEditing} onDelete={del} />}
    {editing && <ResourceForm resource={editing} onClose={() => setEditing(null)} onDone={row => { setEditing(null); list.replace(row); setRevision(n => n + 1) }} />}
  </>)
}
