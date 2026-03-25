import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ===')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d0015] flex items-center justify-center p-4">
          <div className="card-dark rounded-2xl p-6 max-w-md w-full text-center border border-red-500/30">
            <span className="text-5xl mb-4 block">😵</span>
            <h2 className="text-white font-display font-bold text-xl mb-3">
              Something went wrong
            </h2>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-left overflow-auto max-h-40">
              <p className="text-red-400 text-xs font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.location.reload()} 
                className="flex-1 btn-primary text-sm py-2"
              >
                Refresh Page
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                className="flex-1 btn-ghost text-sm py-2"
              >
                Go Home
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-4 font-myanmar">
              If problem persists, please contact support
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
