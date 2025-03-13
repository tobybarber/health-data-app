'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';

// Define the shape of the context
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  resetPassword: async () => {}
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    return signOut(auth);
  };

  const resetPassword = async (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
} 