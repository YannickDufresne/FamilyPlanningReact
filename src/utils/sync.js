import { db, FAMILLE_DOC } from './firebase';
import { setDoc, onSnapshot, getDoc } from 'firebase/firestore';

// Write a partial update to Firestore (merges with existing data)
export async function syncWrite(data) {
  try {
    await setDoc(FAMILLE_DOC, data, { merge: true });
  } catch (e) {
    console.warn('Sync write error:', e);
  }
}

// Read current state from Firestore once
export async function syncRead() {
  try {
    const snap = await getDoc(FAMILLE_DOC);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Sync read error:', e);
    return null;
  }
}

// Subscribe to real-time updates
export function syncSubscribe(callback) {
  return onSnapshot(FAMILLE_DOC, (snap) => {
    if (snap.exists()) callback(snap.data());
  }, (e) => console.warn('Sync subscribe error:', e));
}
