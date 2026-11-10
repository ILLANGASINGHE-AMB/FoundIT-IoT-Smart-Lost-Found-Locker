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
import { isSupabaseConfigured } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {!isSupabaseConfigured && (
            <div className="config-banner" role="alert">
              Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).
            </div>
          )}
          <App />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
