import { initializeApp, getApps, cert, App } from 'firebase-admin/app'

let app: App

/**
 * Returns a singleton Firebase Admin app.
 * Safe to call multiple times (no-op after first init).
 */
export function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!
  }

  // When running inside Firebase Functions, GOOGLE_APPLICATION_CREDENTIALS
  // or the default service account is used automatically.
  // For local emulator / explicit key, set FIREBASE_SERVICE_ACCOUNT_KEY (JSON string).
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  app = serviceAccountKey
    ? initializeApp({ credential: cert(JSON.parse(serviceAccountKey)) })
    : initializeApp() // uses Application Default Credentials

  return app
}
