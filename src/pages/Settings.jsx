import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { avatars, people } from '../services/api'
import { squareJpeg } from '../lib/image'
import { LEVELS, ROLE_LABEL, SOCIALS, SUBJECTS, isHttpUrl, msgError } from '../lib/format'
import { Avatar, FormError, PageHead } from '../components/ui'
import { useConfirm } from '../context/ConfirmContext'

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function Settings() {
  const { profile: me, session, setProfile, updatePassword, signOut } = useAuth(), toast = useToast()
  const confirm = useConfirm()
  const [f, setF] = useState({
    full_name: me.full_name, role: me.role, subject_area: me.subject_area || '', center: me.center || '', city: me.city || '',
    website: me.website || '', bio: me.bio || '', education_levels: me.education_levels || [],
    social: { linkedin: '', github: '', x: '', instagram: '', ...(me.social || {}) },
  })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [upl, setUpl] = useState(false)
  const [pw, setPw] = useState(''), [pwErr, setPwErr] = useState('')
  const [pwBusy, setPwBusy] = useState(false), [leaving, setLeaving] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const setSocial = k => e => setF({ ...f, social: { ...f.social, [k]: e.target.value } })
  const toggle = l => setF({ ...f, education_levels: f.education_levels.includes(l) ? f.education_levels.filter(x => x !== l) : [...f.education_levels, l] })
  const isDoc = f.role === 'docente', alumno = me.role === 'alumno'

  const onAvatar = async e => {
    const file = e.target.files[0]; e.target.value = ''
    if (!file || upl || busy) return
    if (!IMG_TYPES.includes(file.type)) return toast('Usa una imagen JPG, PNG o WebP', 'error')
    if (file.size > 8 * 1024 * 1024) return toast('La imagen pesa demasiado (máximo 8 MB)', 'error')
    setUpl(true)
    try {
      const { url } = await avatars.upload(me.id, await squareJpeg(file))
      const old = me.avatar_url
      try { setProfile(await people.update(me.id, { avatar_url: url })) }
      catch (error) { try { await avatars.remove(url) } catch { toast('No se pudo limpiar la foto subida. Revisa Storage.', 'info') }; throw error }
      if (old) avatars.remove(old).catch(() => toast('Foto guardada. No se pudo retirar el archivo anterior de Storage.', 'info'))
      toast('Foto de perfil actualizada')
    } catch (e) { toast(msgError(e), 'error') } finally { setUpl(false) }
  }
  const removeAvatar = async () => {
    if (upl || busy) return
    setUpl(true)
    try { const old = me.avatar_url; setProfile(await people.update(me.id, { avatar_url: '' })); try { await avatars.remove(old); toast('Foto eliminada') } catch { toast('Foto retirada del perfil. No se pudo borrar el archivo de Storage.', 'info') } }
    catch (e) { toast(msgError(e), 'error') } finally { setUpl(false) }
  }

  const save = async e => {
    e.preventDefault(); setErr('')
    if (busy || upl) return
    if (f.full_name.trim().length < 2) return setErr('El nombre es obligatorio.')
    if (f.website && !isHttpUrl(f.website.trim())) return setErr('La web debe empezar por http:// o https://')
    for (const [k, label] of SOCIALS) if (f.social[k]?.trim() && !isHttpUrl(f.social[k].trim())) return setErr(`${label}: el enlace debe empezar por https://`)
    const roleChanged = !alumno && f.role !== me.role
    if (roleChanged && !await confirm(`Vas a cambiar tu cuenta a «${ROLE_LABEL[f.role]}». ${f.role === 'empresa' ? 'Dejarás de poder crear proyectos y recursos, y de aparecer en el directorio de docentes.' : 'Podrás crear proyectos y recursos, y aparecerás en el directorio.'}`, 'Cambiar tipo de cuenta')) return
    setBusy(true)
    try {
      const patch = {
        full_name: f.full_name.trim(), bio: f.bio.trim(), city: f.city.trim(), website: f.website.trim(),
        social: Object.fromEntries(Object.entries(f.social).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
      }
      if (!alumno) patch.center = f.center.trim()
      if (roleChanged) patch.role = f.role
      if (isDoc) { patch.subject_area = f.subject_area; patch.education_levels = f.education_levels }
      setProfile(await people.update(me.id, patch)); toast(roleChanged ? 'Perfil y tipo de cuenta actualizados' : 'Perfil guardado')
    } catch (e) { setErr(msgError(e)) } finally { setBusy(false) }
  }
  const changePw = async e => {
    e.preventDefault(); setPwErr('')
    if (pwBusy) return
    if (pw.length < 6) return setPwErr('La contraseña debe tener al menos 6 caracteres.')
    setPwBusy(true)
    try { const r = await updatePassword(pw); if (r.error) throw r.error; setPw(''); toast('Contraseña actualizada') }
    catch (error) { setPwErr(msgError(error)) } finally { setPwBusy(false) }
  }

  return (<>
    <PageHead title="Mi perfil" sub={`${ROLE_LABEL[me.role]}, ${session.user.email}`} />
    {alumno && <p className="panel mb-6 px-4 py-3 text-sm">Tu perfil es privado: solo lo ven las personas con las que compartes un proyecto. Por privacidad, las cuentas de alumnado usan iniciales en lugar de foto.</p>}

    {!alumno && (
      <section className="panel mb-6 flex flex-wrap items-center gap-5 p-6" aria-label="Foto de perfil">
        <Avatar name={me.full_name} role={me.role} size={80} src={me.avatar_url} />
        <div>
          <h2 className="h2">Foto de perfil</h2>
          <p className="hint mb-3">JPG, PNG o WebP. Se recorta en cuadrado y se reduce a 256 px, sin datos de ubicación.</p>
          <div className="flex flex-wrap items-center gap-4">
            <label className={`btn btn-s focus-within:outline-2 focus-within:outline-offset-4 ${upl || busy ? 'pointer-events-none opacity-50' : ''}`}>{upl ? 'Subiendo…' : me.avatar_url ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept={IMG_TYPES.join(',')} className="sr-only" onChange={onAvatar} disabled={upl || busy} /></label>
            {me.avatar_url && <button type="button" className="danger" onClick={removeAvatar} disabled={upl || busy}>Quitar foto</button>}
          </div>
        </div>
      </section>)}

    <form onSubmit={save} className="panel p-6"><fieldset disabled={busy || upl}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div><label className="lbl mt-0!" htmlFor="n">{f.role === 'empresa' ? 'Nombre de la empresa' : 'Nombre completo'}</label><input id="n" className="input" value={f.full_name} onChange={set('full_name')} /></div>
        <div><label className="lbl mt-0!" htmlFor="r">Tipo de cuenta</label>
          {alumno ? <p className="input bg-slate-50 text-muted">Alumno (no se puede cambiar)</p>
            : <select id="r" className="input" value={f.role} onChange={set('role')}><option value="docente">Docente</option><option value="empresa">Empresa</option></select>}</div>
      </div>
      {isDoc && (<div className="grid gap-x-4 sm:grid-cols-2">
        <div><label className="lbl" htmlFor="sa">Asignatura o área</label><select id="sa" className="input" value={f.subject_area} onChange={set('subject_area')}><option value="">Sin especificar</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="lbl" htmlFor="ce">Centro educativo</label><input id="ce" className="input" value={f.center} onChange={set('center')} /></div>
      </div>)}
      {f.role === 'empresa' && (<><label className="lbl" htmlFor="ce">Sector o actividad</label><input id="ce" className="input" value={f.center} onChange={set('center')} placeholder="Ejemplo: plataforma de formación online" /></>)}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div><label className="lbl" htmlFor="ci">Ciudad</label><input id="ci" className="input" value={f.city} onChange={set('city')} /></div>
        {!alumno && <div><label className="lbl" htmlFor="w">Web</label><input id="w" className="input" placeholder="https://" value={f.website} onChange={set('website')} /></div>}
      </div>
      {isDoc && (<fieldset className="mt-4"><legend className="text-sm font-semibold">Etapas en las que trabajas</legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">{LEVELS.map(l => <label key={l} className="flex items-center gap-2"><input type="checkbox" checked={f.education_levels.includes(l)} onChange={() => toggle(l)} />{l}</label>)}</div></fieldset>)}
      <label className="lbl" htmlFor="b">{alumno ? 'Sobre ti' : 'Presentación'}</label>
      <textarea id="b" rows={5} maxLength={600} className="input" value={f.bio} onChange={set('bio')} placeholder={isDoc ? 'Qué enseñas, con qué metodologías trabajas y qué tipo de colaboración buscas' : ''} />
      <p className="hint">{f.bio.length}/600</p>
      {!alumno && (<fieldset className="mt-4"><legend className="text-sm font-semibold">Redes sociales</legend>
        <div className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">{SOCIALS.map(([k, l]) => (
          <div key={k}><label className="text-xs font-semibold text-muted" htmlFor={`s-${k}`}>{l}</label><input id={`s-${k}`} className="input" placeholder="https://" value={f.social[k]} onChange={setSocial(k)} /></div>))}</div></fieldset>)}
      <FormError>{err}</FormError>
      <button className="btn mt-5" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
    </fieldset></form>

    <form onSubmit={changePw} className="panel mt-6 p-6">
      <h2 className="h2">Cambiar contraseña</h2>
      <label className="lbl" htmlFor="np">Contraseña nueva</label><input id="np" type="password" className="input max-w-xs" disabled={pwBusy} minLength={6} required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
      <FormError>{pwErr}</FormError>
      <button className="btn btn-s mt-4" disabled={pwBusy}>{pwBusy ? 'Actualizando…' : 'Actualizar contraseña'}</button>
    </form>
    <button className="danger mt-6" disabled={leaving} onClick={async () => { setLeaving(true); try { await signOut() } catch (error) { toast(msgError(error), 'error') } finally { setLeaving(false) } }}>Cerrar sesión</button>
  </>)
}
