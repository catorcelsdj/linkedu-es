import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { projects } from '../services/api'
import { msgError } from '../lib/format'
import { FormError } from './ui'
import Modal from './Modal'
import { TagPicker } from './Tags'

// Creates a project, or edits one when `project` is given (title, description, visibility and tags).
export default function ProjectForm({ project, onClose, onSaved }) {
  const { profile: me } = useAuth(), toast = useToast(), nav = useNavigate()
  const editing = !!project
  const [f, setF] = useState({ title: project?.title || '', description: project?.description || '', is_public: project?.is_public ?? true, tags: project?.tags || [] })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setErr('')
    if (f.title.trim().length < 4) return setErr('El título necesita al menos 4 caracteres.')
    setBusy(true)
    const data = { ...f, title: f.title.trim(), description: f.description.trim() }
    try {
      if (editing) { await projects.update(project.id, data); toast('Proyecto actualizado'); setBusy(false); onSaved?.(data) }
      else { const p = await projects.create(data, me.id); toast('Proyecto creado'); nav(`/proyectos/${p.id}`) }
    } catch (e) { setErr(msgError(e)); setBusy(false) }
  }
  return (
    <Modal title={editing ? 'Editar proyecto' : 'Nuevo proyecto'} onClose={onClose} dismissible={!busy}><form onSubmit={submit}><fieldset disabled={busy}>
      <label className="lbl" htmlFor="t">Título</label><input id="t" className="input" maxLength={100} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
      <label className="lbl" htmlFor="d">¿De qué trata y qué buscas?</label><textarea id="d" rows={4} maxLength={600} className="input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <p className="hint text-right">{f.description.length}/600</p>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={f.is_public} onChange={e => setF({ ...f, is_public: e.target.checked })} />
        <span><b>Proyecto abierto.</b> Aparece en la lista y cualquiera puede solicitar unirse. Si lo desmarcas, solo entra quien tenga el código.</span></label>
      <TagPicker value={f.tags} onChange={tags => setF({ ...f, tags })} />
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear proyecto'}</button></div>
    </fieldset></form></Modal>
  )
}
