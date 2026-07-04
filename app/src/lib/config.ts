import { Platform } from 'react-native';

/**
 * Runtime configuration via EXPO_PUBLIC_* env vars (inlined at build time).
 * Defaults target the local dev stack.
 */

function defaultApiUrl(): string {
  // Android emulators reach the host machine via 10.0.2.2
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || defaultApiUrl(),

  /**
   * Dev-bypass identity. When Firebase isn't configured the app signs in
   * locally and sends `x-dev-user` instead of an ID token (the server only
   * honors it with DEV_AUTH_BYPASS=true).
   */
  devUserEmail: process.env.EXPO_PUBLIC_DEV_USER || '',

  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  },
};

export const firebaseConfigured = Boolean(config.firebase.apiKey && config.firebase.projectId);
