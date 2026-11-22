import { firebaseConfig } from '../firebase-config';
import { LocalStore } from './local-store';
import type { ProfileStore } from './types';

/** True when this build should use Firebase (config filled in and not forced local). */
export const firebaseEnabled = !!firebaseConfig.apiKey && import.meta.env.VITE_STORAGE !== 'local';

export async function openStore(): Promise<ProfileStore> {
  if (firebaseEnabled) {
    try {
      // Loaded on demand so the browser-only build never downloads the Firebase SDK.
      const { FirebaseStore } = await import('./firebase-store');
      return new FirebaseStore(firebaseConfig);
    } catch (e) {
      console.warn('Firebase unavailable, saving in this browser instead', e);
    }
  }
  return new LocalStore();
}
