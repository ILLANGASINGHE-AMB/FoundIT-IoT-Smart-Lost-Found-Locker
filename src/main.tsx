import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import './styles/app.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { queryClient } from './lib/queryClient'
import { isDemoMode } from './lib/supabase'
import { DemoBanner } from './components/ui/DemoBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {isDemoMode && <DemoBanner />}
          <App />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
