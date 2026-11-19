import { Component } from 'react'
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-lg px-6 py-24"><div className="panel p-8"><p className="eyebrow">Linkedu · Un momento</p><h1 className="h1 mt-3">Esta vista no se ha podido abrir</h1><p className="mt-3 text-muted">Vuelve a cargar la página. Si acabas de actualizar la aplicación, se descargará la versión más reciente.</p><button className="btn mt-6" onClick={() => window.location.reload()}>Volver a cargar</button></div></main>
    return this.props.children
  }
}
