'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore as _getFirestore, Firestore } from 'firebase/firestore';
import { getAuth as _getAuth, Auth } from 'firebase/auth';

// Your Firebase configuration object
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let firebaseApp: FirebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

// Initialize Firestore and Auth
const firestoreInstance = _getFirestore(firebaseApp);
const authInstance = _getAuth(firebaseApp);

/**
 * Get Firestore instance
 */
export function getFirestore(): Firestore {
  return firestoreInstance;
}

/**
 * Get Auth instance
 */
export function getAuthInstance(): Auth {
  return authInstance;
} 