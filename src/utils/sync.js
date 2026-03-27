import { db, storage, FAMILLE_DOC } from './firebase';
import { setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

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

// Upload family photo to Firebase Storage, returns download URL
export async function uploadPhoto(dataUrl) {
  try {
    const photoRef = ref(storage, 'famille-principale/photo-famille.jpg');
    await uploadString(photoRef, dataUrl, 'data_url');
    const url = await getDownloadURL(photoRef);
    return url;
  } catch (e) {
    console.warn('Photo upload error:', e);
    return null;
  }
}

// Delete family photo from Firebase Storage
export async function deletePhoto() {
  try {
    const photoRef = ref(storage, 'famille-principale/photo-famille.jpg');
    await deleteObject(photoRef);
  } catch (e) {
    // Ignore if file doesn't exist
  }
}
