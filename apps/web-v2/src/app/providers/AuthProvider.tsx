import { createContext, useContext, useEffect, useState } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { firebaseApp } from '@/shared/config/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Dev mock mode: when Firebase env vars are not set, use a stub user so the UI renders
const IS_FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY

const DEV_MOCK_USER = {
  uid: 'dev-mock-user',
  email: 'dev@local',
  getIdToken: async () => null,
} as unknown as User

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!IS_FIREBASE_CONFIGURED) {
      setUser(DEV_MOCK_USER)
      setLoading(false)
      return
    }
    const auth = getAuth(firebaseApp)
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    if (!IS_FIREBASE_CONFIGURED) { setUser(DEV_MOCK_USER); return }
    await signInWithEmailAndPassword(getAuth(firebaseApp), email, password)
  }

  const handleSignOut = async () => {
    if (!IS_FIREBASE_CONFIGURED) { setUser(null); return }
    await signOut(getAuth(firebaseApp))
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn: handleSignIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
