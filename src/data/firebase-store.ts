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
import { Family, makeFamilyCode, Player, ProfileStore } from './types';

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
  private db: Firestore;
  private ready: Promise<unknown>;

  constructor(config: FirebaseOptions) {
    const app = initializeApp(config);
    this.ready = signInAnonymously(getAuth(app));
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
    const snap = await getDoc(doc(this.db, 'families', code));
    return snap.exists() ? { code, name: String(snap.data().name ?? 'Family') } : null;
  }

  async listPlayers(code: string): Promise<Player[]> {
    await this.ready;
    const snap = await getDocs(collection(this.db, 'families', code, 'players'));
    return snap.docs.map((d) => d.data() as Player);
  }

  async savePlayer(code: string, player: Player): Promise<void> {
    await this.ready;
    // Not awaited past the local write: offline play still saves, and syncs later.
    setDoc(doc(this.db, 'families', code, 'players', player.id), { ...player, updatedAt: Date.now() }).catch((e) =>
      console.warn('Could not save progress to Firebase', e),
    );
  }

  async deletePlayer(code: string, id: string): Promise<void> {
    await this.ready;
    await deleteDoc(doc(this.db, 'families', code, 'players', id));
  }
}
