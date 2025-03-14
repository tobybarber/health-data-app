import admin from 'firebase-admin';

// Check if Firebase Admin has already been initialized
if (!admin.apps.length) {
  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'dummy@example.com',
      // Replace newlines in the private key
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    } as admin.ServiceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
const storage = admin.storage();

export { db, storage }; 