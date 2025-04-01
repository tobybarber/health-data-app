'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface AnalysisSettingsProps {
  onChange?: (settings: AnalysisSettings) => void;
}

export interface AnalysisSettings {
  useRag: boolean; // renamed to includeWearables in UI but kept as useRag for backward compatibility
  includeProfile: boolean;
  includeComments: boolean;
}

export default function AnalysisSettings({ onChange }: AnalysisSettingsProps) {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<AnalysisSettings>({
    useRag: true, // Default to include wearables
    includeProfile: true,
    includeComments: true
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on component mount
  useEffect(() => {
    async function loadSettings() {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const settingsDoc = await getDoc(doc(db, `users/${currentUser.uid}/settings`, 'analysis'));
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setSettings({
            useRag: data.useRag !== false, // Default to true if not set
            includeProfile: data.includeProfile !== false, // Default to true if not set
            includeComments: data.includeComments !== false  // Default to true if not set
          });
        }
      } catch (error) {
        console.error('Error loading analysis settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSettings();
  }, [currentUser]);

  // Save settings when changed
  const saveSettings = async (newSettings: AnalysisSettings) => {
    if (!currentUser) return;
    
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/settings`, 'analysis'), newSettings);
      console.log('Analysis settings saved:', newSettings);
      
      // Notify parent component if onChange handler provided
      if (onChange) {
        onChange(newSettings);
      }
    } catch (error) {
      console.error('Error saving analysis settings:', error);
    }
  };

  // Handle settings change
  const handleSettingChange = (setting: keyof AnalysisSettings, value: boolean) => {
    const newSettings = { ...settings, [setting]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  if (isLoading) {
    return <div className="text-center py-2 text-gray-300">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Include wearables data</span>
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={settings.useRag} // useRag is now used for includeWearables
            onChange={(e) => handleSettingChange('useRag', e.target.checked)}
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-blue-500 ${settings.useRag ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${settings.useRag ? 'translate-x-6' : 'translate-x-1'} top-1`}></div>
          </div>
        </label>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Include profile information</span>
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={settings.includeProfile}
            onChange={(e) => handleSettingChange('includeProfile', e.target.checked)}
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-blue-500 ${settings.includeProfile ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${settings.includeProfile ? 'translate-x-6' : 'translate-x-1'} top-1`}></div>
          </div>
        </label>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Include comments</span>
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={settings.includeComments}
            onChange={(e) => handleSettingChange('includeComments', e.target.checked)}
            className="sr-only peer"
          />
          <div className={`relative w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-blue-500 ${settings.includeComments ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute w-4 h-4 bg-white rounded-full transition-transform ${settings.includeComments ? 'translate-x-6' : 'translate-x-1'} top-1`}></div>
          </div>
        </label>
      </div>
    </div>
  );
} 