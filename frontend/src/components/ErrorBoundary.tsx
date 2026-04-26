import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Terjadi Kesalahan
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, maxWidth: 400 }}>
            Komponen mengalami error tidak terduga. Coba muat ulang halaman.
          </div>
          {this.state.error && (
            <code style={{
              fontSize: 11, color: 'var(--error)', background: 'var(--bg-tertiary)',
              padding: '6px 10px', borderRadius: 6, marginBottom: 20, maxWidth: 500,
              overflow: 'auto', display: 'block', textAlign: 'left'
            }}>
              {this.state.error.message}
            </code>
          )}
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
          >
            Muat Ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
