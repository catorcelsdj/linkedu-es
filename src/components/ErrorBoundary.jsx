import { Component } from 'react'
// `inline` is used inside the app layout: it renders a section (the layout already has <main>) and the
// layout gives it a key per route, so navigating elsewhere recovers without reloading the whole app.
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    const Tag = this.props.inline ? 'section' : 'main'
    return <Tag className={this.props.inline ? '' : 'mx-auto max-w-lg px-6 py-24'}><div className="panel p-8"><p className="eyebrow">Linkedu · Un momento</p><h1 className="h1 mt-3">Esta vista no se ha podido abrir</h1><p className="mt-3 text-muted">{this.props.inline ? 'Puedes volver a intentarlo o ir a otra sección desde el menú.' : 'Vuelve a cargar la página. Si acabas de actualizar la aplicación, se descargará la versión más reciente.'}</p><div className="mt-6 flex flex-wrap gap-3">{this.props.inline && <button className="btn btn-s" onClick={() => this.setState({ failed: false })}>Reintentar</button>}<button className="btn" onClick={() => window.location.reload()}>Volver a cargar</button></div></div></Tag>
  }
}
