'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profileDoc = await getDoc(doc(db, 'profile', 'user'));
        
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
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      await setDoc(doc(db, 'profile', 'user'), profile);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-blue-600 mb-6">My Profile</h1>
      
      {loading ? (
        <p className="text-gray-600">Loading profile...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>
              
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={profile.age}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your age"
                />
              </div>
              
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={profile.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  id="height"
                  name="height"
                  value={profile.height}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your height in cm"
                />
              </div>
              
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={profile.weight}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your weight in kg"
                />
              </div>
              
              <div>
                <label htmlFor="smoking" className="block text-sm font-medium text-gray-700 mb-1">
                  Smoking Status
                </label>
                <select
                  id="smoking"
                  name="smoking"
                  value={profile.smoking}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select status</option>
                  <option value="never">Never smoked</option>
                  <option value="former">Former smoker</option>
                  <option value="occasional">Occasional smoker</option>
                  <option value="regular">Regular smoker</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="alcohol" className="block text-sm font-medium text-gray-700 mb-1">
                  Alcohol Consumption
                </label>
                <select
                  id="alcohol"
                  name="alcohol"
                  value={profile.alcohol}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select consumption</option>
                  <option value="none">None</option>
                  <option value="occasional">Occasional (1-2 drinks/week)</option>
                  <option value="moderate">Moderate (3-7 drinks/week)</option>
                  <option value="heavy">Heavy (8+ drinks/week)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="diet" className="block text-sm font-medium text-gray-700 mb-1">
                  Diet
                </label>
                <select
                  id="diet"
                  name="diet"
                  value={profile.diet}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select diet type</option>
                  <option value="whole-foods">Mostly whole foods (fruits, vegetables, lean meats, whole grains)</option>
                  <option value="mixed">Balanced mix of whole foods and some processed foods</option>
                  <option value="processed">Mostly processed foods (fast food, sugary drinks, packaged snacks)</option>
                  <option value="irregular">Irregular eating (skipping meals, heavy snacking, little variety)</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="exercise" className="block text-sm font-medium text-gray-700 mb-1">
                  Exercise Frequency
                </label>
                <select
                  id="exercise"
                  name="exercise"
                  value={profile.exercise}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label htmlFor="familyHistory" className="block text-sm font-medium text-gray-700 mb-1">
                  Family Medical History
                </label>
                <textarea
                  id="familyHistory"
                  name="familyHistory"
                  value={profile.familyHistory}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter relevant family medical history (e.g., heart disease, diabetes, cancer)"
                ></textarea>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Profile saved successfully!
            </div>
          )}
          
          <div className="flex justify-between">
            <Link href="/records" className="text-blue-600 hover:underline">
              Back to Records
            </Link>
            
            <button
              type="submit"
              disabled={saving}
              className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                saving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 