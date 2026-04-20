import { getFirebaseApp } from '@hato-tms/firebase'
import { onRequest } from 'firebase-functions/v2/https'
import { createApp } from './app'

// Initialize Firebase Admin once at cold start
getFirebaseApp()

// Export the Express app as a Firebase Function
export const api = onRequest(
  {
    region: 'asia-southeast1',   // Singapore — closest to TH
    memory: '256MiB',
    timeoutSeconds: 60,
    minInstances: 0,             // set to 1 in prod to reduce cold start
  },
  createApp(),
)
