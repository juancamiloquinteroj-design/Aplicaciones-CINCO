/// <reference types="vite/client" />

import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  getDoc,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { PM, Estructura, PMBase, RelacionTransformacion } from "../types";

// Firebase Configuration with real verified credentials
const firebaseConfig = {
  apiKey: "AIzaSyA_pB8r6LTwQyNrcvjYQEA1bWZ7DQRcPs4",
  authDomain: "estado-pm.firebaseapp.com",
  projectId: "estado-pm",
  storageBucket: "estado-pm.firebasestorage.app",
  messagingSenderId: "892829661834",
  appId: "1:892829661834:web:c1c371235ff52131214b73"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with robust local persistent cache and the custom Database ID
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, "ai-studio-gestindepuntosde-41546656-8c88-45ea-8cac-3700245388c5");

export const isFirebaseConfigured = true;

export interface FirebaseStatus {
  configured: boolean;
  connected: boolean;
  lastError: string | null;
}

export let firebaseStatus: FirebaseStatus = {
  configured: true,
  connected: true,
  lastError: null,
};

export function getFirebaseStatus(): FirebaseStatus {
  return { ...firebaseStatus };
}

export async function ensureFirebaseInitialized(): Promise<boolean> {
  return true;
}

export async function testFirebaseConnection(): Promise<FirebaseStatus> {
  try {
    const docRef = doc(db, "settings", "status");
    await getDoc(docRef);
    firebaseStatus.connected = true;
    firebaseStatus.lastError = null;
  } catch (e: any) {
    console.error("🔴 Firebase connection test failed:", e);
    firebaseStatus.connected = false;
    let errorMsg = e?.message || String(e);
    if (errorMsg.includes("permission-denied") || errorMsg.includes("Missing or insufficient permissions")) {
      errorMsg = "Permiso denegado (Reglas de Seguridad de Firestore bloquean el acceso). Configure sus reglas en la consola de Firebase para permitir lecturas/escrituras.";
    }
    firebaseStatus.lastError = errorMsg;
  }
  return getFirebaseStatus();
}

// Helper to handle local storage fallback (so the app works out-of-the-box in the preview!)
const getLocal = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocal = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Helper function to wrap Firebase promises with a strict timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Firestore operation timed out")), timeoutMs)
    )
  ]);
}

// --- API METHODS ---

function handleFirebaseSuccess() {
  firebaseStatus.connected = true;
  firebaseStatus.lastError = null;
}

function handleFirebaseError(e: any) {
  firebaseStatus.connected = false;
  let msg = e?.message || String(e);
  if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
    msg = "Permiso denegado (Reglas de Seguridad de Firestore bloquean el acceso). Configure sus reglas en la consola de Firebase.";
  } else if (msg.includes("timed out") || msg.includes("timeout")) {
    msg = "Tiempo de espera agotado. El servidor de Firebase no respondió.";
  }
  firebaseStatus.lastError = msg;
}

// Registered PMs (Puntos de Medida)
export async function getPMs(): Promise<PM[]> {
  const deletedIds = new Set(getLocal<string[]>("pm_deleted_ids", []));

  if (isFirebaseConfigured && db) {
    try {
      const querySnapshot = await getDocs(collection(db, "pms"));
      const pms: PM[] = [];
      querySnapshot.forEach((docSnap) => {
        if (deletedIds.has(docSnap.id)) {
          // Permanently enforce deletion in Firestore if a deleted ID is encountered
          deleteDoc(doc(db, "pms", docSnap.id)).catch(() => {});
        } else {
          pms.push({ id: docSnap.id, ...docSnap.data() } as PM);
        }
      });
      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
      // Save clean local cache copy
      setLocal("pm_registrations", pms);
      return pms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (e) {
      console.error("Error fetching PMs from Firestore:", e);
      handleFirebaseError(e);
    }
  }
  const localPMs = getLocal<PM[]>("pm_registrations", []).filter(p => !deletedIds.has(p.id));
  return localPMs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// Real-time Firestore subscription so all devices stay 100% in sync automatically
export function subscribePMs(callback: (pms: PM[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    return () => {};
  }

  return onSnapshot(
    collection(db, "pms"),
    (querySnapshot) => {
      const deletedIds = new Set(getLocal<string[]>("pm_deleted_ids", []));
      const pms: PM[] = [];
      
      querySnapshot.forEach((docSnap) => {
        if (deletedIds.has(docSnap.id)) {
          deleteDoc(doc(db, "pms", docSnap.id)).catch(() => {});
        } else {
          pms.push({ id: docSnap.id, ...docSnap.data() } as PM);
        }
      });

      const sorted = pms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      // Keep local storage cache in sync
      setLocal("pm_registrations", sorted);
      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
      
      callback(sorted);
    },
    (error) => {
      console.error("Error in real-time PMs subscription:", error);
      handleFirebaseError(error);
    }
  );
}

export async function savePM(pm: PM): Promise<void> {
  pm.updatedAt = new Date().toISOString();
  
  // Clear from deletion log if previously deleted
  const deletedIds = getLocal<string[]>("pm_deleted_ids", []);
  if (deletedIds.includes(pm.id)) {
    setLocal("pm_deleted_ids", deletedIds.filter(id => id !== pm.id));
  }

  // Mark as unsynced creation/edit until confirmed by Firestore write
  const unsyncedIds = getLocal<string[]>("pm_unsynced_ids", []);
  if (!unsyncedIds.includes(pm.id)) {
    unsyncedIds.push(pm.id);
    setLocal("pm_unsynced_ids", unsyncedIds);
  }

  // Save to local cache
  const current = getLocal<PM[]>("pm_registrations", []);
  const existsIdx = current.findIndex(p => p.id === pm.id);
  if (existsIdx > -1) {
    current[existsIdx] = pm;
  } else {
    current.push(pm);
  }
  setLocal("pm_registrations", current);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "pms", pm.id);
      await setDoc(docRef, pm);

      // Remove from unsynced list on success
      const curUnsynced = getLocal<string[]>("pm_unsynced_ids", []);
      setLocal("pm_unsynced_ids", curUnsynced.filter(id => id !== pm.id));

      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
    } catch (e) {
      console.error("Error saving PM to Firestore:", e);
      handleFirebaseError(e);
    }
  }
}

export async function deletePM(id: string): Promise<void> {
  // 1. Filter local cache
  const current = getLocal<PM[]>("pm_registrations", []);
  const filtered = current.filter(p => p.id !== id);
  setLocal("pm_registrations", filtered);

  // Remove from unsynced list if it was never pushed
  const unsyncedIds = getLocal<string[]>("pm_unsynced_ids", []);
  setLocal("pm_unsynced_ids", unsyncedIds.filter(i => i !== id));

  // 2. Track deletion persistently
  const deletedIds = getLocal<string[]>("pm_deleted_ids", []);
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    setLocal("pm_deleted_ids", deletedIds);
  }

  // 3. Delete from Firestore
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, "pms", id));

      // Clear from deleted tracking once Firestore execution completes
      const curDeleted = getLocal<string[]>("pm_deleted_ids", []);
      setLocal("pm_deleted_ids", curDeleted.filter(i => i !== id));

      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
    } catch (e) {
      console.error("Error deleting PM from Firestore:", e);
      handleFirebaseError(e);
    }
  }
}

// Network Base Data (Estructuras, PM Mappings & Relaciones de Transformación)
export interface BaseData {
  estructuras: Record<string, Estructura>;
  pms: Record<string, PMBase>;
  relaciones: Record<string, RelacionTransformacion>;
}

export async function getBaseNetworkData(): Promise<BaseData> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "network_base", "all_data");
      const docSnap = await getDoc(docRef);
      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.compressedData) {
          const parsed = JSON.parse(data.compressedData);
          setLocal("estMaestroCache_v5", parsed.estructuras || {});
          setLocal("pmsDictCache_v5", parsed.pms || {});
          setLocal("relacionesCache_v5", parsed.relaciones || {});
          return {
            estructuras: parsed.estructuras || {},
            pms: parsed.pms || {},
            relaciones: parsed.relaciones || {}
          };
        }
        const structures = data.estructuras || {};
        const pmsDict = data.pms || {};
        const relDict = data.relaciones || {};
        setLocal("estMaestroCache_v5", structures);
        setLocal("pmsDictCache_v5", pmsDict);
        setLocal("relacionesCache_v5", relDict);
        return { estructuras: structures, pms: pmsDict, relaciones: relDict };
      }
    } catch (e) {
      console.error("Error fetching network base from Firestore:", e);
      handleFirebaseError(e);
    }
  }
  
  return {
    estructuras: getLocal<Record<string, Estructura>>("estMaestroCache_v5", {}),
    pms: getLocal<Record<string, PMBase>>("pmsDictCache_v5", {}),
    relaciones: getLocal<Record<string, RelacionTransformacion>>("relacionesCache_v5", {})
  };
}

export async function saveBaseNetworkData(
  estructuras: Record<string, Estructura>,
  pms: Record<string, PMBase>,
  relaciones: Record<string, RelacionTransformacion> = {}
): Promise<void> {
  setLocal("estMaestroCache_v5", estructuras);
  setLocal("pmsDictCache_v5", pms);
  setLocal("relacionesCache_v5", relaciones);

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "network_base", "all_data");
      const compressedData = JSON.stringify({ estructuras, pms, relaciones });
      await setDoc(docRef, { compressedData, updatedAt: new Date().toISOString() });
      firebaseStatus.connected = true;
      firebaseStatus.lastError = null;
    } catch (e) {
      console.error("Error saving network base to Firestore:", e);
      handleFirebaseError(e);
    }
  }
}

// Automatically migrate any local storage data to Firestore if Firebase has just been configured or when syncing
export async function syncLocalDataToFirestoreIfAny(): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    const deletedIds = getLocal<string[]>("pm_deleted_ids", []);
    const remainingDeleted: string[] = [];

    // 1. Process pending deletions in Firestore first
    if (deletedIds.length > 0) {
      for (const id of deletedIds) {
        try {
          await deleteDoc(doc(db, "pms", id));
        } catch (e) {
          console.error(`Error deleting doc ${id} during sync:`, e);
          remainingDeleted.push(id);
        }
      }
      setLocal("pm_deleted_ids", remainingDeleted);
    }

    // 2. Fetch current remote PMs snapshot
    const querySnapshot = await getDocs(collection(db, "pms"));
    const remotePMs = new Map<string, PM>();
    querySnapshot.forEach((docSnap) => {
      remotePMs.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as PM);
    });

    const localPMs = getLocal<PM[]>("pm_registrations", []);
    const unsyncedIds = new Set(getLocal<string[]>("pm_unsynced_ids", []));

    const batch = writeBatch(db);
    let hasBatchOps = false;
    const syncedIds: string[] = [];
    const updatedLocalPMs: PM[] = [];

    // 3. Selective sync
    for (const localPM of localPMs) {
      if (deletedIds.includes(localPM.id)) continue;

      const remotePM = remotePMs.get(localPM.id);

      if (!remotePM) {
        // If it does not exist in Firestore:
        // Only push if it was created locally offline (is in unsyncedIds)
        if (unsyncedIds.has(localPM.id)) {
          const docRef = doc(db, "pms", localPM.id);
          batch.set(docRef, localPM);
          hasBatchOps = true;
          syncedIds.push(localPM.id);
          updatedLocalPMs.push(localPM);
        } else {
          // If NOT in unsyncedIds, it means it was deleted on remote by another device!
          // Do NOT upload it, and remove it from local cache.
          console.log(`PM ${localPM.id} was deleted remotely; removing from local cache.`);
        }
      } else {
        // If it exists in Firestore
        const localTime = new Date(localPM.updatedAt || 0).getTime();
        const remoteTime = new Date(remotePM.updatedAt || 0).getTime();
        if (localTime > remoteTime) {
          const docRef = doc(db, "pms", localPM.id);
          batch.set(docRef, localPM);
          hasBatchOps = true;
          syncedIds.push(localPM.id);
          updatedLocalPMs.push(localPM);
        } else {
          updatedLocalPMs.push(remotePM);
        }
      }
    }

    // Include any remote PMs not present locally
    for (const [id, remotePM] of Array.from(remotePMs.entries())) {
      if (!deletedIds.includes(id) && !updatedLocalPMs.some(p => p.id === id)) {
        updatedLocalPMs.push(remotePM);
      }
    }

    if (hasBatchOps) {
      await batch.commit();
      console.log("🟢 Local changes synced to Firestore successfully.");
    }

    // Clear synced IDs
    const curUnsynced = getLocal<string[]>("pm_unsynced_ids", []);
    setLocal("pm_unsynced_ids", curUnsynced.filter(id => !syncedIds.includes(id)));

    // Save strictly updated clean local cache
    setLocal("pm_registrations", updatedLocalPMs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));

    // 2. Migrate alert emails
    const localEmails = getLocal<string[]>("pm_alert_emails", []);
    if (localEmails && localEmails.length > 0) {
      const docRef = doc(db, "settings", "alert_recipients");
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists() || !docSnap.data()?.emails || docSnap.data()?.emails.length === 0) {
        console.log("Migrating alert emails to Firestore...");
        await setDoc(docRef, { emails: localEmails });
        console.log("🟢 Alert emails migrated to Firestore successfully.");
      }
    }

    // 3. Migrate Base Network Data (estructuras, pms base, and relaciones)
    const localEst = getLocal<Record<string, Estructura>>("estMaestroCache_v5", {});
    const localBasePMs = getLocal<Record<string, PMBase>>("pmsDictCache_v5", {});
    const localRel = getLocal<Record<string, RelacionTransformacion>>("relacionesCache_v5", {});
    if (Object.keys(localEst).length > 0 || Object.keys(localBasePMs).length > 0 || Object.keys(localRel).length > 0) {
      const docRef = doc(db, "network_base", "all_data");
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.log("Migrating base network data to Firestore...");
        const compressedData = JSON.stringify({ estructuras: localEst, pms: localBasePMs, relaciones: localRel });
        await setDoc(docRef, { compressedData, updatedAt: new Date().toISOString() });
        console.log("🟢 Base network data migrated to Firestore successfully.");
      }
    }
    firebaseStatus.connected = true;
    firebaseStatus.lastError = null;
  } catch (e) {
    console.error("🔴 Error syncing local data to Firestore:", e);
    handleFirebaseError(e);
  }
}

