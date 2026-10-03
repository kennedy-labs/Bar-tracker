import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyApMSqhH-AW64dGFAIFfRPu579w649bZx4",
  authDomain: "bar-tracker-12738.firebaseapp.com",
  projectId: "bar-tracker-12738",
  storageBucket: "bar-tracker-12738.firebasestorage.app",
  messagingSenderId: "981717379254",
  appId: "1:981717379254:web:4bd72ee6dd8b745c931e17"
};

// Initialize Firebase once
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
