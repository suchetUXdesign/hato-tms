import axios from 'axios'
import { getAuth } from 'firebase/auth'
import { firebaseApp } from '@/shared/config/firebase'

export const apiClient = axios.create({
  baseURL: '/api/v1',
})

const DEV_API_TOKEN        = import.meta.env.VITE_DEV_API_TOKEN
const IS_FIREBASE_CONFIGURED = !!import.meta.env.VITE_FIREBASE_API_KEY

apiClient.interceptors.request.use(async (config) => {
  if (DEV_API_TOKEN) {
    config.headers['X-API-Token'] = DEV_API_TOKEN
    return config
  }
  if (!IS_FIREBASE_CONFIGURED) return config
  const token = await getAuth(firebaseApp).currentUser?.getIdToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && IS_FIREBASE_CONFIGURED) {
      getAuth(firebaseApp).signOut()
    }
    return Promise.reject(err)
  },
)
