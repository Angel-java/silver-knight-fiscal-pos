import './assets/main.css'

import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
import App from './App'

window.onerror = (message, source, lineno, colno, error) => {
  document.getElementById('root')!.innerHTML =
    `<pre style="color:red;white-space:pre-wrap;padding:20px;font-size:12px">WINDOW ERROR: ${message}\n${source}:${lineno}:${colno}\n${error?.stack}</pre>`
}

window.addEventListener('unhandledrejection', (e) => {
  document.getElementById('root')!.innerHTML =
    `<pre style="color:red;white-space:pre-wrap;padding:20px;font-size:12px">UNHANDLED REJECTION: ${e.reason}\n${e.reason?.stack}</pre>`
})

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: 'red', whiteSpace: 'pre-wrap', padding: 20, fontSize: 12 }}>
          {this.state.error.message}\n{this.state.error.stack}
        </pre>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
