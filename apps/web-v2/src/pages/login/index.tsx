import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/app/providers/AuthProvider'
import { LoginForm } from '@/features/auth/ui/LoginForm'
import { ROUTES } from '@/shared/config/routes'

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: ROUTES.KEYS })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <LoginForm />
    </div>
  )
}
