import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { projects } from '../services/api'
import { msgError } from '../lib/format'
import { FormError } from './ui'
import Modal from './Modal'
import Icon from './Icon'
import { TagPicker } from './Tags'

const VISIBILITY = [
  [true, 'globe', 'Abierto', 'Aparece en la lista de proyectos y cualquiera puede pedir unirse.'],
  [false, 'lock', 'Privado', 'No aparece en la lista. Solo entra quien tenga el código de invitación.'],
]
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
      <fieldset className="mt-4"><legend className="text-sm font-semibold">¿Quién puede encontrarlo?</legend>
        <div className="visibility">{VISIBILITY.map(([open, icon, title, text]) => (
          <label key={title} className={`visibility-card ${f.is_public === open ? 'selected' : ''}`}>
            <input type="radio" name="visibilidad" className="role-radio" checked={f.is_public === open} onChange={() => setF({ ...f, is_public: open })} />
            <span className="card-icon"><Icon name={icon} size={20} /></span><b>{title}</b><p>{text}</p>
            <span className="visibility-check" aria-hidden="true"><Icon name="check" size={13} /></span>
          </label>))}</div>
      </fieldset>
      <TagPicker value={f.tags} onChange={tags => setF({ ...f, tags })} />
      <FormError>{err}</FormError>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button><button className="btn" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear proyecto'}</button></div>
    </fieldset></form></Modal>
  )
}
