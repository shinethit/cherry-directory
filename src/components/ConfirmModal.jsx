import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const ConfirmContext = createContext(null)

// Global bridge — non-React code can trigger modals via confirmDialog()
let globalOpen = null

export function openConfirm(options) {
  if (globalOpen) return globalOpen(options)
  // Fallback — native confirm (should not normally happen)
  return Promise.resolve(window.confirm(typeof options === 'string' ? options : options.message))
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const open = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState({
        title: opts.title || 'သေချာပါသလား?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'အတည်ပြု',
        cancelText: opts.cancelText || 'မလုပ်တော့ပါ',
        destructive: opts.destructive !== false,
      })
    })
  }, [])

  useEffect(() => {
    globalOpen = open
    return () => { globalOpen = null }
  }, [open])

  const close = (result) => {
    setState(null)
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
  }

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pt-safe pb-safe bg-black/75 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm bg-[#140020] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-5 pb-4">
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + (
                state.destructive
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-brand-600/20 text-brand-300'
              )}>
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-display font-bold text-base text-white font-myanmar leading-snug">
                  {state.title}
                </h3>
                {state.message && (
                  <p className="text-sm text-white/60 font-myanmar leading-relaxed mt-1.5 whitespace-pre-wrap break-words">
                    {state.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => close(false)}
                className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2 p-4 pt-1">
              <button
                onClick={() => close(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-display font-semibold hover:bg-white/10 transition-colors font-myanmar"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => close(true)}
                className={'flex-1 py-2.5 rounded-xl text-sm font-display font-semibold transition-colors font-myanmar ' + (
                  state.destructive
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-brand-600 text-white hover:bg-brand-500'
                )}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
