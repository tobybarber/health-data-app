'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import { FaSignOutAlt } from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';
import PageLayout from '../components/PageLayout';

interface UserProfile {
  name: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  smoking: string;
  alcohol: string;
  diet: string;
  exercise: string;
  familyHistory: string;
}

export default function ProfilePage() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    smoking: '',
    alcohol: '',
    diet: '',
    exercise: '',
    familyHistory: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const profileDoc = await getDoc(doc(db, 'profile', currentUser.uid));
        
        if (profileDoc.exists()) {
          const data = profileDoc.data() as UserProfile;
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      await setDoc(doc(db, 'profile', currentUser.uid), profile);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Redirect to home page after saving
      router.push('/');
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile data');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
      setError('Failed to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <ProtectedRoute>
      <PageLayout 
        title="My Profile"
        isHomePage={true}
      >
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={handleLogout}
            className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-md text-primary-blue border border-primary-blue hover:bg-black/90 transition-colors flex items-center"
          >
            <FaSignOutAlt className="mr-2" /> Sign Out
          </button>
        </div>
        
        <div className="bg-black p-6 rounded-lg shadow-sm border border-gray-800">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-primary-blue mb-4">Account Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <div className="bg-gray-900 px-3 py-2 rounded-md text-gray-300 border border-gray-700">
                  {currentUser?.email}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Account Created</label>
                <div className="bg-gray-900 px-3 py-2 rounded-md text-gray-300 border border-gray-700">
                  {currentUser?.metadata?.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-primary-blue mb-4">Security</h2>
            
            <button 
              onClick={() => setShowChangePassword(true)}
              className="text-primary-blue border border-primary-blue px-4 py-2 rounded-md hover:bg-gray-800/20 transition-colors"
            >
              Change Password
            </button>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-primary-blue mb-4">Data Management</h2>
            
            <button 
              onClick={() => setShowDeleteAccount(true)}
              className="text-red-600 border border-red-600 px-4 py-2 rounded-md hover:bg-red-600/10 transition-colors"
            >
              Delete Account
            </button>
            <p className="mt-2 text-sm text-gray-400">
              This will permanently delete your account and all associated data.
            </p>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {loading ? (
          <p className="text-gray-600">Loading profile...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={profile.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-400"
                    placeholder="Enter your name"
                  />
                </div>
                
                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">
                    Year of Birth
                  </label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    value={profile.age}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-400"
                    placeholder="Enter your year of birth"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
                
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={profile.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-gray-300 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    id="height"
                    name="height"
                    value={profile.height}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-400"
                    placeholder="Enter your height in cm"
                  />
                </div>
                
                <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-300 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    id="weight"
                    name="weight"
                    value={profile.weight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-400"
                    placeholder="Enter your weight in kg"
                  />
                </div>
                
                <div>
                  <label htmlFor="smoking" className="block text-sm font-medium text-gray-300 mb-1">
                    Smoking Status
                  </label>
                  <select
                    id="smoking"
                    name="smoking"
                    value={profile.smoking}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white"
                  >
                    <option value="">Select status</option>
                    <option value="never">Never smoked</option>
                    <option value="former">Former smoker</option>
                    <option value="occasional">Occasional smoker</option>
                    <option value="regular">Regular smoker</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="alcohol" className="block text-sm font-medium text-gray-300 mb-1">
                    Alcohol Consumption
                  </label>
                  <select
                    id="alcohol"
                    name="alcohol"
                    value={profile.alcohol}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white"
                  >
                    <option value="">Select consumption</option>
                    <option value="none">None</option>
                    <option value="occasional">Occasional (1-2 drinks/week)</option>
                    <option value="moderate">Moderate (3-7 drinks/week)</option>
                    <option value="heavy">Heavy (8+ drinks/week)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="diet" className="block text-sm font-medium text-gray-300 mb-1">
                    Diet
                  </label>
                  <select
                    id="diet"
                    name="diet"
                    value={profile.diet}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white"
                  >
                    <option value="">Select diet type</option>
                    <option value="whole-foods">Mostly whole foods (fruits, vegetables, lean meats, whole grains)</option>
                    <option value="mixed">Balanced mix of whole foods and some processed foods</option>
                    <option value="processed">Mostly processed foods (fast food, sugary drinks, packaged snacks)</option>
                    <option value="irregular">Irregular eating (skipping meals, heavy snacking, little variety)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="exercise" className="block text-sm font-medium text-gray-300 mb-1">
                    Exercise Frequency
                  </label>
                  <select
                    id="exercise"
                    name="exercise"
                    value={profile.exercise}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white"
                  >
                    <option value="">Select frequency</option>
                    <option value="sedentary">Sedentary (little to no exercise)</option>
                    <option value="light">Light (1-2 days/week)</option>
                    <option value="moderate">Moderate (3-4 days/week)</option>
                    <option value="active">Active (5+ days/week)</option>
                    <option value="very-active">Very active (daily intense exercise)</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label htmlFor="familyHistory" className="block text-sm font-medium text-gray-300 mb-1">
                    Family Medical History
                  </label>
                  <textarea
                    id="familyHistory"
                    name="familyHistory"
                    value={profile.familyHistory}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-400"
                    placeholder="Enter relevant family medical history (e.g., heart disease, diabetes, cancer)"
                  ></textarea>
                </div>
              </div>
            </div>
            
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                Profile saved successfully!
              </div>
            )}
            
            <div className="flex justify-between">
              <Link href="/records" className="text-white hover:underline">
                Back to Records
              </Link>
              
              <button
                type="submit"
                disabled={saving}
                className={`bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                  saving ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </PageLayout>
    </ProtectedRoute>
  );
} 