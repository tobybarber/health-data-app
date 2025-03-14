'use client';

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Link from 'next/link';
import HomeNavigation from '../components/HomeNavigation';

// Define device types
interface DeviceType {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
}

export default function WearablesPage() {
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<DeviceType[]>([
    {
      id: 'fitbit',
      name: 'Fitbit',
      logo: '/images/fitbit-logo.png',
      connected: false
    },
    {
      id: 'apple-watch',
      name: 'Apple Watch',
      logo: '/images/apple-watch-logo.png',
      connected: false
    },
    {
      id: 'garmin',
      name: 'Garmin',
      logo: '/images/garmin-logo.png',
      connected: false
    },
    {
      id: 'samsung',
      name: 'Samsung Health',
      logo: '/images/samsung-health-logo.png',
      connected: false
    }
  ]);

  const handleConnectDevice = (deviceId: string) => {
    // In a real app, this would initiate OAuth flow
    alert(`This would connect to ${deviceId} in a real application`);
    
    // For demo purposes, toggle the connected state
    setDevices(devices.map(device => 
      device.id === deviceId 
        ? { ...device, connected: !device.connected } 
        : device
    ));
  };

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <HomeNavigation />
        <h1 className="text-2xl font-bold text-primary-blue mb-6">My Wearables</h1>
        
        <p className="mb-6 text-gray-700">
          Connect your wearable devices to automatically import health data.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {devices.map(device => (
            <div key={device.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                  {/* Placeholder for device logo */}
                  <span className="text-xl font-bold text-gray-400">{device.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-medium text-primary-blue">{device.name}</h3>
                  <p className="text-sm text-gray-500">
                    {device.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleConnectDevice(device.id)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  device.connected 
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                    : 'bg-primary-blue text-white hover:bg-blue-700'
                }`}
              >
                {device.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
        
        <h2 className="text-lg font-medium text-primary-blue mb-2">Manual Data Entry</h2>
        <p className="text-gray-700 mb-4">
          Don't have a wearable device? You can still track your health data manually.
        </p>
        <Link 
          href="/manual-record" 
          className="bg-primary-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-block"
        >
          Enter Data Manually
        </Link>
      </div>
    </ProtectedRoute>
  );
} 