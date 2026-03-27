import { initializeApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDuOtSdZ7gcvpTtu8qMfpvwpFmKZBSdGAg",
  authDomain: "familyplanning-b2c93.firebaseapp.com",
  projectId: "familyplanning-b2c93",
  storageBucket: "familyplanning-b2c93.firebasestorage.app",
  messagingSenderId: "409928644623",
  appId: "1:409928644623:web:79aa66c8eedc382a2e8b7a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const FAMILLE_DOC = doc(db, 'familles', 'famille-principale');
