'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence, inMemoryPersistence, Auth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  // Check if Firebase is already initialized
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  auth = getAuth(app);
  
  // Set persistence to browser local for better reliability
  setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
      // Fall back to in-memory persistence if local fails
      return setPersistence(auth, inMemoryPersistence);
    });
  
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  throw new Error('Failed to initialize Firebase: ' + (error as Error).message);
}

// Function to get Firebase config for debugging
const getFirebaseConfig = () => {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket
  };
};

export { storage, db, auth, getFirebaseConfig }; 