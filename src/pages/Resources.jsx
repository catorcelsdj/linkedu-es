import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { resources } from '../services/api'
import { usePaged, useDebounce } from '../hooks/usePaged'
import { FILE_EXT, LEVELS, MAX_FILE, SUBJECTS, isHttpUrl, msgError } from '../lib/format'
import { useConfirm } from '../context/ConfirmContext'
import { openResource } from '../lib/openResource'
import Icon from '../components/Icon'
import { FormError, LoadMore, PageHead, Status } from '../components/ui'
import ResourceCard from '../components/ResourceCard'
import Modal from '../components/Modal'
import { TagFilter, TagPicker } from '../components/Tags'

function NewResource({ onClose, onDone }) {
  const { profile: me } = useAuth(), toast = useToast()
  const [kind, setKind] = useState('link'), [file, setFile] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [f, setF] = useState({ title: '', description: '', subject_area: me.subject_area || '', education_level: '', link_url: '', tags: [] })
  const set = k => e => setF({ ...f, [k]: e.target.value })

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (busy) return
    if (f.title.trim().length < 3) return setErr('El título necesita al menos 3 caracteres.')
    if (!f.subject_area) return setErr('Elige una asignatura.')
    if (kind === 'link' && !isHttpUrl(f.link_url.trim())) return setErr('El enlace debe ser una dirección http:// o https:// válida.')
    if (kind === 'file') {
      if (!file) return setErr('Elige un fichero.')
      if (!FILE_EXT.includes(file.name.split('.').pop().toLowerCase())) return setErr(`Formatos permitidos: ${FILE_EXT.join(', ')}.`)
      if (file.size > MAX_FILE) return setErr('El fichero supera los 5 MB. Súbelo a Drive u OneDrive y comparte el enlace.')
    }
    setBusy(true)
    try {
      const meta = { title: f.title.trim(), description: f.description.trim(), subject_area: f.subject_area, education_level: f.education_level, tags: f.tags }
      await resources.create(kind === 'link' ? { ...meta, link_url: f.link_url.trim() } : meta, kind === 'file' ? file : null, me.id)
      toast('Recurso publicado'); onDone()
    } catch (e) { setErr(msgError(e)); setBusy(false) }
  }
  return (
    <Modal title="Compartir recurso" onClose={onClose} dismissible={!busy}><form onSubmit={submit}><fieldset disabled={busy}>
      <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="group" aria-label="Tipo de recurso">
        {[['link', 'Enlace externo'], ['file', 'Fichero (hasta 5 MB)']].map(([k, l]) => <button type="button" aria-pressed={kind === k} key={k} onClick={() => setKind(k)} className={`flex-1 cursor-pointer rounded-lg py-1.5 ${kind === k ? 'bg-surface text-navy' : 'text-muted'}`}>{l}</button>)}
      </div>
      <label className="lbl" htmlFor="rt">Título</label><input id="rt" className="input" maxLength={120} value={f.title} onChange={set('title')} autoFocus />
      <label className="lbl" htmlFor="rd">Descripción</label><textarea id="rd" rows={3} maxLength={500} className="input" placeholder="Para qué curso sirve y cómo usarlo" value={f.description} onChange={set('description')} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="lbl" htmlFor="rs">Asignatura</label><select id="rs" className="input" value={f.subject_area} onChange={set('subject_area')}><option value="">Elige una</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="lbl" htmlFor="rl">Etapa</label><select id="rl" className="input" value={f.education_level} onChange={set('education_level')}><option value="">Cualquiera</option>{LEVELS.map(s => <option key={s}>{s}</option>)}</select></div>
      </div>
      {kind === 'link'
        ? (<><label className="lbl" htmlFor="ru">Enlace</label><input id="ru" className="input" placeholder="https://" value={f.link_url} onChange={set('link_url')} /></>)
        : (<><label className="lbl" htmlFor="rf">Fichero</label><input id="rf" type="file" className="input" accept={FILE_EXT.map(x => '.' + x).join(',')} onChange={e => setFile(e.target.files[0] || null)} /><p className="hint">Formatos: {FILE_EXT.join(', ')}.</p></>)}
      <TagPicker value={f.tags} onChange={tags => setF({ ...f, tags })} />
      <p className="hint mt-3">Los recursos los ve cualquier persona con cuenta. No subas datos personales del alumnado.</p>
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy}>{busy ? 'Publicando…' : 'Publicar'}</button></div>
    </fieldset></form></Modal>
  )
}

export default function Resources() {
  const { profile: me } = useAuth(), toast = useToast()
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(null)
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(''), [subject, setSubject] = useState(''), [level, setLevel] = useState(''), [tags, setTags] = useState([]), dq = useDebounce(q)
  const [open, setOpen] = useState(!!sp.get('nuevo') && me.role === 'docente')
  useEffect(() => { if (sp.get('nuevo') === '1' && me.role === 'docente') setOpen(true) }, [sp, me.role])
  const list = usePaged((from, to) => resources.list({ q: dq, subject, level, tags, from, to }), [dq, subject, level, tags])
  const close = () => { setOpen(false); setSp({}) }

  const openRes = async r => { try { await openResource(r) } catch (e) { toast(msgError(e), 'error') } }
  const del = async r => {
    if (deleting || !await confirm(`¿Eliminar «${r.title}»? Esta acción no se puede deshacer.`, 'Eliminar recurso')) return
    setDeleting(r.id)
    try { const result = await resources.remove(r); toast(result.warning || 'Recurso eliminado', result.warning ? 'info' : 'ok'); list.reload() } catch (e) { toast(msgError(e), 'error') } finally { setDeleting(null) }
  }
  const empty = dq || subject || level || tags.length
    ? { icon: 'search', title: 'Ningún recurso con esos filtros', text: 'Prueba a quitar la asignatura o la etapa.' }
    : { icon: 'resources', title: 'El banco está vacío', text: me.role === 'docente' ? 'Comparte tu primer material de aula: un enlace o un fichero.' : 'Cuando los docentes compartan material, aparecerá aquí.', action: me.role === 'docente' ? { label: 'Compartir recurso', onClick: () => setOpen(true) } : undefined }
  return (<>
    <PageHead title="Banco de recursos" sub="Material de aula compartido por docentes, ordenado por asignatura y etapa.">
      {me.role === 'docente' && <button className="btn" onClick={() => setOpen(true)}><Icon name="plus" size={17} />Compartir recurso</button>}
    </PageHead>
    <div className="filter-bar">
      <input className="input max-w-xs flex-1" type="search" placeholder="Buscar" aria-label="Buscar recursos" value={q} onChange={e => setQ(e.target.value)} />
      <select className="input w-auto" aria-label="Asignatura" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Todas las asignaturas</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
      <select className="input w-auto" aria-label="Etapa" value={level} onChange={e => setLevel(e.target.value)}><option value="">Todas las etapas</option>{LEVELS.map(s => <option key={s}>{s}</option>)}</select>
    </div>
    <TagFilter value={tags} onChange={setTags} />
    <Status loading={list.loading} error={list.error} count={list.items.length} empty={empty} onRetry={list.reload} />
    <div className="grid gap-4 md:grid-cols-2">{list.items.map(r => <ResourceCard key={r.id} r={r} uid={me.id} onOpen={openRes} onDelete={del} busy={!!deleting} />)}</div>
    <LoadMore more={list.more} loading={list.loading} onClick={list.loadMore} />
    {open && <NewResource onClose={close} onDone={() => { close(); list.reload() }} />}
  </>)
}
