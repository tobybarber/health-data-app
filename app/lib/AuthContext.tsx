'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signOut, 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  UserCredential,
  Auth
} from 'firebase/auth';
import { auth } from './firebase';

// Define the shape of the context
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  login: (email: string, password: string) => Promise<UserCredential>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  authInitialized: boolean;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => { /* Empty implementation */ },
  resetPassword: async () => { /* Empty implementation */ },
  login: async (email: string, password: string) => { 
    // This should never be called directly, only through the provider
    throw new Error('AuthContext provider not initialized');
  },
  signup: async (email: string, password: string) => {
    // This should never be called directly, only through the provider
    throw new Error('AuthContext provider not initialized');
  },
  authInitialized: false
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Check local storage for cached auth state
    if (typeof window !== 'undefined') {
      const cachedAuthUser = localStorage.getItem('authUser');
      if (cachedAuthUser && cachedAuthUser !== 'null') {
        try {
          // We can't fully restore the User object, but we can use this as a hint
          // that the user was previously logged in
          setAuthInitialized(true);
        } catch (e) {
          // Error parsing cached auth user
        }
      }
    }
    
    // Set a timeout to ensure loading state isn't stuck forever
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      setAuthInitialized(true);
      
      // Cache auth state in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('authUser', user ? JSON.stringify({
          uid: user.uid,
          email: user.email,
          isAuthenticated: true
        }) : 'null');
      }
      
      clearTimeout(timeoutId); // Clear timeout if auth state changed successfully
    }, (error) => {
      // Error handler for onAuthStateChanged
      setLoading(false);
      setAuthInitialized(true);
      clearTimeout(timeoutId);
    });

    // Cleanup function
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const logout = async () => {
    // Clear session storage to ensure a new chat on next login
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('app_session_id');
      sessionStorage.removeItem('messages_loaded');
      localStorage.removeItem('authUser');
    }
    try {
      await signOut(auth);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result;
    } catch (error) {
      throw error; // Re-throw to be handled by the login form
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result;
    } catch (error) {
      throw error; // Re-throw to be handled by the signup form
    }
  };

  const value = {
    currentUser,
    loading,
    logout,
    resetPassword,
    login,
    signup,
    authInitialized
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
} 