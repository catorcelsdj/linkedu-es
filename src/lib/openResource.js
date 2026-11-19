import { resources } from '../services/api'
// Open synchronously during the click so browsers do not block the signed download.
export async function openResource(resource) {
  const target = window.open('about:blank', '_blank')
  if (!target) throw new Error('Permite las ventanas emergentes para abrir este recurso.')
  target.opener = null
  try { target.location.replace(await resources.url(resource)) }
  catch (error) { target.close(); throw error }
}
