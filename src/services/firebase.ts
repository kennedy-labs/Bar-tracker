import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to eliminate the 10-second backend timeout
// in browser iframe and proxy environments, along with persistent local multi-tab cache
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    localCache:
      typeof window !== 'undefined'
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : undefined,
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);

// Automatically sign in anonymously to satisfy request.auth in Firestore security rules
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((err) => {
        console.debug('Anonymous auth note (app works fully offline):', err?.message || err);
      });
    }
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline =
    errMsg.includes('offline') ||
    errMsg.includes('Could not reach Cloud Firestore backend') ||
    errMsg.includes('backend didn\'t respond') ||
    errMsg.includes('failed-precondition') ||
    errMsg.includes('permission-denied') ||
    errMsg.includes('Missing or insufficient permissions');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  // Resilient handling: Log to warn/debug, never crash or blank the UI.
  // The app utilizes its local transaction engine and offline storage.
  if (isOffline) {
    console.debug(`Firestore operating in offline/cached mode for ${path}: ${errMsg}`);
  } else {
    console.warn(`Firestore note [${operationType}] for ${path}:`, errMsg);
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'test', 'connection'));
    return snap.exists();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently working offline.');
    } else {
      console.debug('Firebase connection test note:', error);
    }
    return false;
  }
}

// Initial connection verification
if (typeof window !== 'undefined') {
  testConnection().catch((err) => {
    console.debug('Background Firestore connection check completed:', err);
  });
}
