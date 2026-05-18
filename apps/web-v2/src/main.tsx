import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import './index.css'
import { router }           from '@/app/router'
import { AuthProvider }     from '@/app/providers/AuthProvider'
import { QueryProvider }    from '@/app/providers/QueryProvider'
import { LocaleProvider }   from '@/shared/lib/useTranslation'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <QueryProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryProvider>
    </LocaleProvider>
  </StrictMode>,
)
