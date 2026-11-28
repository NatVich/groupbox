import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  getDoc,
  getDocFromCache,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { cleanName, Family, makeFamilyCode, Player, ProfileStore, ProgressPatch, sanitizePlayer, SetupError } from './types';

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
      return snap.exists() ? { code, name: cleanName(String(snap.data().name ?? '')) || 'Family' } : null;
    } catch (e) {
      throw friendly(e);
    }
  }

  async listPlayers(code: string): Promise<Player[]> {
    await this.ready;
    try {
      const snap = await getDocs(collection(this.db, 'families', code, 'players'));
      return snap.docs
        .map((d) => sanitizePlayer(d.data()))
        .filter((p): p is Player => p !== null);
    } catch (e) {
      throw friendly(e);
    }
  }

  private playerRef(code: string, id: string) {
    return doc(this.db, 'families', code, 'players', id);
  }

  /**
   * Starts a write without waiting for the server: offline play still saves (Firestore queues
   * the write on the device) and syncs later. Failures are reported through onSaveError.
   */
  private write(code: string, id: string, data: Record<string, unknown>, merge: boolean) {
    setDoc(this.playerRef(code, id), data, { merge }).catch(async (e) => {
      console.warn('Could not save to Firebase', e);
      let err = friendly(e);
      if ((e as { code?: string })?.code === 'permission-denied') {
        // The usual cause for an existing family: this player was deleted on another device.
        const gone = await getDoc(this.playerRef(code, id)).then((s) => !s.exists(), () => false);
        if (gone) err = new Error('This player was deleted on another device, so this game was not saved.');
      }
      this.onSaveError?.(err);
    });
  }

  async savePlayer(code: string, player: Player): Promise<void> {
    await this.ready;
    this.write(code, player.id, { ...player, updatedAt: Date.now() }, false);
  }

  async saveProfile(code: string, id: string, profile: Pick<Player, 'name' | 'avatar'>): Promise<void> {
    await this.ready;
    this.write(code, id, { name: profile.name, avatar: profile.avatar, updatedAt: Date.now() }, true);
  }

  async saveProgress(code: string, id: string, patch: ProgressPatch): Promise<void> {
    await this.ready;
    // The latest copy this device has (it includes other devices' saves it has seen), so a
    // device that has been open for days never lowers a score saved somewhere else.
    let known: Player | null = null;
    try {
      const snap = await getDocFromCache(this.playerRef(code, id));
      if (snap.exists()) known = sanitizePlayer(snap.data());
    } catch {
      /* not cached on this device: the server keeps the higher value for keys we don't send */
    }
    const data: Record<string, unknown> = { updatedAt: Date.now() };
    for (const field of ['levelStars', 'levelBest', 'daily'] as const) {
      const values = patch[field];
      if (!values) continue;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) out[k] = Math.max(v, known?.[field]?.[k] ?? 0);
      data[field] = out;
    }
    if (patch.dropDaily?.length) {
      const daily = (data.daily ?? {}) as Record<string, unknown>;
      for (const k of patch.dropDaily) daily[k] = deleteField();
      data.daily = daily;
    }
    if (patch.calmBest !== undefined) data.calmBest = Math.max(patch.calmBest, known?.calmBest ?? 0);
    // merge: only the fields above change; everything else in the record is left as it is.
    this.write(code, id, data, true);
  }

  async deletePlayer(code: string, id: string): Promise<void> {
    await this.ready;
    await deleteDoc(doc(this.db, 'families', code, 'players', id));
  }
}
