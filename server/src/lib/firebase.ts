import fs from 'fs';
import admin from 'firebase-admin';
import { env } from '../config/env';

let app: admin.app.App | null = null;
let initAttempted = false;

/**
 * Lazily initialize firebase-admin. Returns null when no credentials are
 * configured (local dev with DEV_AUTH_BYPASS + local storage fallback).
 */
export function getFirebase(): admin.app.App | null {
  if (initAttempted) return app;
  initAttempted = true;

  try {
    let credential: admin.credential.Credential | null = null;

    if (env.firebase.serviceAccountJson) {
      credential = admin.credential.cert(JSON.parse(env.firebase.serviceAccountJson));
    } else if (env.firebase.serviceAccountPath && fs.existsSync(env.firebase.serviceAccountPath)) {
      credential = admin.credential.cert(
        JSON.parse(fs.readFileSync(env.firebase.serviceAccountPath, 'utf8')),
      );
    }

    if (!credential) {
      if (!env.devAuthBypass) {
        console.warn(
          '[firebase] No credentials configured and DEV_AUTH_BYPASS is off — auth will reject all requests.',
        );
      }
      return null;
    }

    app = admin.initializeApp({
      credential,
      storageBucket: env.firebase.storageBucket,
    });
    console.log('[firebase] initialized');
  } catch (err) {
    console.error('[firebase] initialization failed:', err);
    app = null;
  }
  return app;
}

export async function verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  const firebase = getFirebase();
  if (!firebase) throw new Error('Firebase is not configured');
  return firebase.auth().verifyIdToken(token);
}
