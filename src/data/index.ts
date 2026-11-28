import { firebaseConfig } from '../firebase-config';
import { LocalStore } from './local-store';
import type { ProfileStore } from './types';

/** True when this build should use Firebase (config filled in and not forced local). */
export const firebaseEnabled = !!firebaseConfig.apiKey && import.meta.env.VITE_STORAGE !== 'local';

/** The online saving code couldn't be downloaded (offline, or an old page after an update). */
export class LoadError extends Error {}

export async function openStore(): Promise<ProfileStore> {
  if (!firebaseEnabled) return new LocalStore();
  try {
    // Loaded on demand so the browser-only build never downloads the Firebase SDK.
    const { FirebaseStore } = await import('./firebase-store');
    return new FirebaseStore(firebaseConfig);
  } catch (e) {
    // Never fall back to browser-only saving here: that would make this device forget its family.
    console.error(e);
    throw new LoadError('Could not load online saving');
  }
}
