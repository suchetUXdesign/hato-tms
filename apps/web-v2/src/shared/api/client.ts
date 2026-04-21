import axios from 'axios'
import { getAuth } from 'firebase/auth'
import { firebaseApp } from '@/shared/config/firebase'

export const apiClient = axios.create({
  baseURL: '/api/v1',
})

apiClient.interceptors.request.use(async (config) => {
  const auth = getAuth(firebaseApp)
  const token = await auth.currentUser?.getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      getAuth(firebaseApp).signOut()
    }
    return Promise.reject(err)
  },
)
