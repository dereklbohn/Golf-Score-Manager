
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB3H9vfVXa4u879N0r0RyHNOEWl6_ReK7U',
  authDomain: 'golf-score-3c0a6.firebaseapp.com',
  projectId: 'golf-score-3c0a6',
  storageBucket: 'golf-score-3c0a6.firebasestorage.app',
  messagingSenderId: '670220716336',
  appId: '1:670220716336:web:808c141cfd87f1209c20f5',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Keep the user's login session between app launches.
let auth: Auth;

try {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // Firebase 13 exposes this in its native runtime, but omits it from
    // the public TypeScript entry point selected by firebase/auth.
    const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (error: any) {
  if (error?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

const db = getFirestore(app);

export { app, auth, db };
