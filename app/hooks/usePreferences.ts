'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  notifications: boolean;
  language: string;
  voiceEnabled: boolean;
  autoSave: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  fontSize: 'medium',
  notifications: true,
  language: 'en-US',
  voiceEnabled: true,
  autoSave: true,
};

interface UsePreferencesReturn extends UserPreferences {
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const usePreferences = (): UsePreferencesReturn => {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        const prefsDoc = await getDoc(doc(db as Firestore, 'userPreferences', currentUser.uid));
        if (prefsDoc.exists()) {
          setPreferences(prefsDoc.data() as UserPreferences);
        } else {
          // If no preferences exist, create default ones
          await setDoc(doc(db as Firestore, 'userPreferences', currentUser.uid), defaultPreferences);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [currentUser?.uid]);

  const updatePreferences = useCallback(async (newPrefs: Partial<UserPreferences>) => {
    if (!currentUser?.uid) {
      setError('No user logged in');
      return;
    }

    try {
      setError(null);
      const updatedPrefs = { ...preferences, ...newPrefs };
      await setDoc(doc(db as Firestore, 'userPreferences', currentUser.uid), updatedPrefs);
      setPreferences(updatedPrefs);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
    }
  }, [currentUser?.uid, preferences]);

  const resetPreferences = useCallback(async () => {
    if (!currentUser?.uid) {
      setError('No user logged in');
      return;
    }

    try {
      setError(null);
      await setDoc(doc(db as Firestore, 'userPreferences', currentUser.uid), defaultPreferences);
      setPreferences(defaultPreferences);
    } catch (err) {
      console.error('Error resetting preferences:', err);
      setError('Failed to reset preferences');
    }
  }, [currentUser?.uid]);

  return {
    ...preferences,
    updatePreferences,
    resetPreferences,
    loading,
    error,
  };
}; 