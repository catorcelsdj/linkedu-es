import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FormError, Isotipo, ThemeSwitch } from '../components/ui'
import Icon from '../components/Icon'
import { SUBJECTS, msgError } from '../lib/format'
const ROLES = [['docente', 'Docente', 'projects', 'Ideas que cruzan aulas.'], ['alumno', 'Alumno', 'resources', 'Aprender haciendo, juntos.'], ['empresa', 'Empresa', 'people', 'Talento que transforma.']]
export function Frame({ children }) {
  return <main className="auth-layout"><section className="auth-story"><a href="/" className="brand" aria-label="Linkedu, inicio"><Isotipo className="h-10" /><span>Linkedu<span className="text-electric">.</span><small>LA RED QUE EDUCA</small></span></a><div className="auth-story-content"><p className="eyebrow"><span className="status-dot" />UN ESPACIO. MUCHAS POSIBILIDADES.</p><h1>La educación<br />avanza cuando<br /><span>conectamos.</span></h1><p className="auth-description">Encuentra a tu gente. Comparte lo que sabes.<br className="hidden sm:block" /> Da forma a lo que viene.</p><div className="connection-art" aria-hidden="true"><svg viewBox="0 0 480 140"><path d="M40 90C140 90 120 35 230 35S330 110 440 80" /><circle cx="40" cy="90" r="8" /><circle cx="230" cy="35" r="11" /><circle cx="440" cy="80" r="8" /></svg><span className="connection-label node-one">Una idea</span><span className="connection-label node-two"><Icon name="spark" size={16} />Una conexión</span><span className="connection-label node-three">Un nuevo comienzo</span></div><div className="auth-audiences">{ROLES.map(([key, label, icon, description]) => <div key={key}><Icon name={icon} /><b>{label}</b><p>{description}</p></div>)}</div></div><p className="auth-caption">Proyectos compartidos. Aprendizaje sin fronteras.</p></section><section className="auth-form-area"><div className="auth-theme"><ThemeSwitch compact /></div><div className="panel auth-form-card">{children}</div><p className="auth-form-foot"><Icon name="lock" size={14} />Tu espacio para aprender y colaborar.</p></section></main>
}
export function ResetPassword() {
  const { updatePassword, signOut } = useAuth()
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault(); if (busy) return; setError('')
    if (pw.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (pw !== pw2) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    try { const result = await updatePassword(pw); if (result.error) throw result.error }
    catch (err) { setError(msgError(err)) } finally { setBusy(false) }
  }
  return <Frame><form onSubmit={submit}><p className="eyebrow">Vuelve a tu espacio</p><h2 className="h1 mt-3">Nueva contraseña</h2><fieldset disabled={busy}><label className="lbl" htmlFor="p1">Contraseña nueva</label><input id="p1" type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" minLength={6} required /><label className="lbl" htmlFor="p2">Repítela</label><input id="p2" type="password" className="input" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" required /><FormError>{error}</FormError><button className="btn mt-5 w-full">{busy ? 'Guardando…' : 'Guardar contraseña'}</button><button type="button" className="link mt-4 text-sm" onClick={() => signOut().catch(err => setError(msgError(err)))}>Volver al acceso</button></fieldset></form></Frame>
}
export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('login'), [f, setF] = useState({ email: '', password: '', full_name: '', role: 'docente', subject_area: '' })
  const [consent, setConsent] = useState(false), [message, setMessage] = useState(null), [busy, setBusy] = useState(false), [visible, setVisible] = useState(false)
  const set = key => event => setF({ ...f, [key]: event.target.value })
  const go = next => { if (!busy) { setMode(next); setMessage(null) } }
  const submit = async event => {
    event.preventDefault(); if (busy) return; setMessage(null)
    if (mode === 'signup' && f.full_name.trim().length < 2) return setMessage({ text: 'Escribe un nombre de al menos dos caracteres.' })
    if (mode === 'signup' && f.role === 'alumno' && !consent) return setMessage({ text: 'Confirma tu edad o la autorización de tu tutor.' })
    setBusy(true)
    try {
      const result = mode === 'login' ? await signIn(f.email, f.password) : mode === 'forgot' ? await resetPassword(f.email) : await signUp(f.email, f.password, f.full_name.trim(), f.role, f.role === 'docente' ? f.subject_area : '')
      if (result.error) throw result.error
      if (mode === 'forgot') setMessage({ text: 'Si ese correo tiene cuenta, recibirás un enlace para elegir una contraseña nueva.', ok: true })
      else if (mode === 'signup' && !result.data.session) setMessage({ text: 'Revisa tu correo para confirmar la cuenta. Después podrás entrar.', ok: true })
    } catch (err) { setMessage({ text: msgError(err) }) } finally { setBusy(false) }
  }
  return <Frame><form onSubmit={submit}><p className="eyebrow">{mode === 'signup' ? 'Empieza algo grande' : mode === 'forgot' ? 'Te ayudamos a volver' : 'Qué bien verte por aquí'}</p><h2 className="h1 mt-3">{{ login: 'Tu comunidad te espera.', signup: 'Hagamos la conexión.', forgot: 'Recupera tu acceso.' }[mode]}</h2><p className="mt-3 text-sm text-muted">{mode === 'login' ? 'Entra y continúa donde lo dejaste.' : mode === 'signup' ? 'Un perfil. Un mundo de colaboración.' : 'Te enviaremos un enlace a tu correo.'}</p><fieldset disabled={busy}>
    {mode === 'signup' && <><fieldset className="mt-5 grid grid-cols-3 gap-2"><legend className="sr-only">Tipo de cuenta</legend>{ROLES.map(([key, label, icon]) => <label key={key} className={`role-choice ${f.role === key ? 'selected' : ''}`}><input type="radio" name="role" className="role-radio" checked={f.role === key} onChange={() => setF({ ...f, role: key })} /><Icon name={icon} /><b>{label}</b></label>)}</fieldset><label className="lbl" htmlFor="fn">{f.role === 'empresa' ? 'Nombre de la empresa' : 'Nombre completo'}</label><input id="fn" className="input" maxLength={120} value={f.full_name} onChange={set('full_name')} autoComplete="name" required minLength={2} />{f.role === 'docente' && <><label className="lbl" htmlFor="sa">Asignatura o área</label><select id="sa" className="input" value={f.subject_area} onChange={set('subject_area')}><option value="">Sin especificar</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></>}</>}
    <label className="lbl" htmlFor="em">Correo electrónico</label><input id="em" type="email" className="input" placeholder="nombre@tucentro.es" value={f.email} onChange={set('email')} autoComplete="email" required />
    {mode !== 'forgot' && <><label className="lbl" htmlFor="pw">Contraseña</label><div className="relative"><input id="pw" type={visible ? 'text' : 'password'} className="input pr-20" placeholder="Tu contraseña" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 6 : undefined} required /><button type="button" className="password-toggle" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>{mode === 'signup' && <p className="hint">Mínimo 6 caracteres.</p>}</>}
    {mode === 'signup' && f.role === 'alumno' && <label className="mt-4 flex gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>Tengo 14 años o más, o cuento con la autorización de mi madre, padre o tutor.</span></label>}
    {mode === 'login' && <div className="mt-3 text-right"><button type="button" className="link text-xs" onClick={() => go('forgot')}>He olvidado mi contraseña</button></div>}
    {message && <p role={message.ok ? 'status' : 'alert'} className={`notice mt-4 ${message.ok ? 'notice-success' : 'notice-error'}`}>{message.text}</p>}
    <button className="btn mt-6 w-full">{busy ? 'Un momento…' : { login: 'Entrar a mi espacio', signup: 'Crear mi cuenta', forgot: 'Enviar enlace' }[mode]}{!busy && <Icon name="arrow" size={18} />}</button>
    <div className="mt-6 border-t border-line pt-5 text-center text-sm"><span className="text-muted">{mode === 'login' ? '¿Aún no formas parte? ' : mode === 'signup' ? '¿Ya tienes cuenta? ' : ''}</span><button type="button" className="link" onClick={() => go(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Crea tu cuenta' : 'Volver a entrar'}</button></div>
  </fieldset></form></Frame>
}
