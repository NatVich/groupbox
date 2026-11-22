import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Family, makeFamilyCode, Player, ProfileStore, SetupError } from './types';

/** Turns Firebase error codes into messages that say which console setting to fix. */
function friendly(e: unknown): Error {
  const code = String((e as { code?: string })?.code ?? '');
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation')
    return new SetupError('Sign-in is not switched on yet. In the Firebase console, open Authentication, then Sign-in method, and turn on Anonymous.');
  if (code === 'auth/unauthorized-domain')
    return new SetupError('This website address is not allowed yet. In the Firebase console, open Authentication, then Settings, then Authorized domains, and add it.');
  if (code === 'permission-denied')
    return new SetupError('Firebase refused the request. In the Firebase console, open Firestore Database, then Rules, and publish the rules from firestore.rules.');
  if (code === 'failed-precondition' || code === 'not-found')
    return new SetupError('The database is not created yet. In the Firebase console, open Firestore Database and click Create database.');
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Profiles in Cloud Firestore, shared across devices by family code.
 *
 *   families/{CODE}                 { name, createdAt }
 *   families/{CODE}/players/{id}    Player
 *
 * Devices sign in anonymously; firestore.rules only lets signed-in clients fetch a family
 * whose exact code they know (no listing). Writes queue offline and sync when back online.
 */
export class FirebaseStore implements ProfileStore {
  readonly kind = 'firebase';
  onSaveError?: (e: Error) => void;
  private db: Firestore;
  private ready: Promise<unknown>;

  constructor(config: FirebaseOptions) {
    const app = initializeApp(config);
    this.ready = signInAnonymously(getAuth(app)).catch((e) => {
      throw friendly(e);
    });
    this.ready.catch(() => {}); // reported when a call awaits it, not as an unhandled rejection
    let db: Firestore;
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      db = initializeFirestore(app, {});
    }
    this.db = db;
  }

  async createFamily(name: string): Promise<Family> {
    await this.ready;
    try {
      return await this.tryCreateFamily(name);
    } catch (e) {
      throw friendly(e);
    }
  }

  private async tryCreateFamily(name: string): Promise<Family> {
    for (let i = 0; i < 10; i++) {
      const code = makeFamilyCode();
      const ref = doc(this.db, 'families', code);
      if ((await getDoc(ref)).exists()) continue;
      await setDoc(ref, { name, createdAt: serverTimestamp() });
      return { code, name };
    }
    throw new Error('Could not make a new family code. Please try again.');
  }

  async getFamily(code: string): Promise<Family | null> {
    await this.ready;
    try {
      const snap = await getDoc(doc(this.db, 'families', code));
      return snap.exists() ? { code, name: String(snap.data().name ?? 'Family') } : null;
    } catch (e) {
      throw friendly(e);
    }
  }

  async listPlayers(code: string): Promise<Player[]> {
    await this.ready;
    try {
      const snap = await getDocs(collection(this.db, 'families', code, 'players'));
      return snap.docs.map((d) => d.data() as Player);
    } catch (e) {
      throw friendly(e);
    }
  }

  async savePlayer(code: string, player: Player): Promise<void> {
    await this.ready;
    // Not awaited past the local write: offline play still saves, and syncs later.
    setDoc(doc(this.db, 'families', code, 'players', player.id), { ...player, updatedAt: Date.now() }).catch((e) => {
      console.warn('Could not save progress to Firebase', e);
      this.onSaveError?.(friendly(e));
    });
  }

  async deletePlayer(code: string, id: string): Promise<void> {
    await this.ready;
    await deleteDoc(doc(this.db, 'families', code, 'players', id));
  }
}
