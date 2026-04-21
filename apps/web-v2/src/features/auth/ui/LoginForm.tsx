import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button }        from '@/shared/ui/button'
import { Input }         from '@/shared/ui/input'
import { Label }         from '@/shared/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { ROUTES } from '@/shared/config/routes'

const LoginSchema = v.object({
  email:    v.pipe(v.string(), v.email('Please enter a valid email')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required')),
})

export function LoginForm() {
  const { signIn }  = useAuth()
  const navigate    = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = v.safeParse(LoginSchema, { email, password })
    if (!result.success) {
      setError(result.issues[0].message)
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      navigate({ to: ROUTES.KEYS })
    } catch {
      setError('Login failed. Please check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl">Hato TMS</CardTitle>
        <CardDescription>Translation Management System</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
