'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Link from 'next/link';
import Navigation from '../components/Navigation';
import { WearableDevice, DeviceInfo, connectDevice, disconnectDevice, syncDeviceData, getConnectedDevices, getDeviceDisplayName, getDeviceDescription } from '../lib/wearable-service';
import toast from 'react-hot-toast';
import { useBackgroundLogo } from '../components/ClientWrapper';
import LoadingSpinner from '../components/LoadingSpinner';
import WearableDataDashboard from '../components/charts/WearableDataDashboard';
import { getFirestore } from 'firebase/firestore';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';

// Define all supported devices
const AVAILABLE_DEVICES: {
  id: WearableDevice;
  name: string;
  logo: string;
  description: string;
  authFields: Array<{
    name: string;
    type: 'text' | 'password' | 'email';
    label: string;
    placeholder: string;
  }>;
}[] = [
  {
    id: 'fitbit/versa',
    name: 'Fitbit',
    logo: '/images/fitbit-logo.png',
    description: 'Fitness and health smartwatch',
    authFields: [
      { name: 'client_id', type: 'text', label: 'Client ID', placeholder: 'Your Fitbit API Client ID' },
      { name: 'client_secret', type: 'password', label: 'Client Secret', placeholder: 'Your Fitbit API Client Secret' }
    ]
  },
  {
    id: 'whoop/whoop_4',
    name: 'Whoop',
    logo: '/images/fitbit-logo.png', // Using placeholder image for now
    description: 'Fitness and recovery wearable',
    authFields: [
      { name: 'email', type: 'email', label: 'Email', placeholder: 'Your Whoop account email' },
      { name: 'password', type: 'password', label: 'Password', placeholder: 'Your Whoop account password' }
    ]
  },
  {
    id: 'garmin/fenix_7s',
    name: 'Garmin',
    logo: '/images/garmin-logo.png',
    description: 'GPS multisport smartwatch',
    authFields: [
      { name: 'email', type: 'email', label: 'Email', placeholder: 'Your Garmin Connect email' },
      { name: 'password', type: 'password', label: 'Password', placeholder: 'Your Garmin Connect password' }
    ]
  },
  {
    id: 'withings/scanwatch',
    name: 'Withings',
    logo: '/images/samsung-health-logo.png', // Using placeholder image for now
    description: 'Hybrid smartwatch with ECG',
    authFields: [
      { name: 'email', type: 'email', label: 'Email', placeholder: 'Your Withings account email' },
      { name: 'password', type: 'password', label: 'Password', placeholder: 'Your Withings account password' }
    ]
  },
  {
    id: 'dexcom/pro_cgm',
    name: 'Dexcom',
    logo: '/images/apple-watch-logo.png', // Using placeholder image for now
    description: 'Continuous glucose monitoring',
    authFields: [
      { name: 'username', type: 'text', label: 'Username', placeholder: 'Your Dexcom username' },
      { name: 'password', type: 'password', label: 'Password', placeholder: 'Your Dexcom password' }
    ]
  },
  {
    id: 'withings/bodyplus',
    name: 'Withings Scale',
    logo: '/images/samsung-health-logo.png', // Using placeholder image for now
    description: 'Smart scale with body composition',
    authFields: [
      { name: 'email', type: 'email', label: 'Email', placeholder: 'Your Withings account email' },
      { name: 'password', type: 'password', label: 'Password', placeholder: 'Your Withings account password' }
    ]
  }
];

// Interface for device display
interface DeviceDisplay {
  id: WearableDevice;
  name: string;
  logo: string;
  description: string;
  connected: boolean;
  lastSync?: Date;
  authFields: Array<{
    name: string;
    type: 'text' | 'password' | 'email';
    label: string;
    placeholder: string;
  }>;
  isTestData: boolean;
}

export default function WearablesPage() {
  const { currentUser } = useAuth();
  const { setShowBackgroundLogo } = useBackgroundLogo();
  const [devices, setDevices] = useState<DeviceDisplay[]>([]);
  
  const [selectedDevice, setSelectedDevice] = useState<DeviceDisplay | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authFormData, setAuthFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [syncedData, setSyncedData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ 
    status: string; 
    deviceId: string;
    message: string;
    dataCounts?: {
      heartRate?: number;
      steps?: number;
      sleep?: number;
      activities?: number;
    }
  }>({ status: 'idle', deviceId: '', message: '' });
  // Add debug state variables
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [dataValidation, setDataValidation] = useState<{
    hasHeartRateData: boolean;
    hasStepData: boolean;
    hasSleepData: boolean;
    hasAnyValidData: boolean;
  }>({
    hasHeartRateData: false,
    hasStepData: false,
    hasSleepData: false,
    hasAnyValidData: false
  });
  // Add state to track whether we have visualizations to show
  const [hasVisualizationData, setHasVisualizationData] = useState(false);

  // Hide background logo when component mounts
  useEffect(() => {
    setShowBackgroundLogo(false);
    return () => {
      setShowBackgroundLogo(true);
    };
  }, [setShowBackgroundLogo]);
  
  // Load synced data from localStorage on initial render
  useEffect(() => {
    if (!currentUser) return;
    
    try {
      // Get cached visualization data from localStorage
      const cachedDataKey = `wearable_data_${currentUser.uid}`;
      const cachedData = localStorage.getItem(cachedDataKey);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        console.log('Loaded cached wearable data from localStorage');
        setSyncedData(parsedData);
        validateSyncedData(parsedData);
        setHasVisualizationData(true);
      }
    } catch (error) {
      console.error('Error loading cached wearable data:', error);
    }
  }, [currentUser]);
  
  // Save synced data to localStorage whenever it changes
  useEffect(() => {
    if (!currentUser || !syncedData) return;
    
    try {
      // Store visualization data in localStorage
      const dataKey = `wearable_data_${currentUser.uid}`;
      localStorage.setItem(dataKey, JSON.stringify(syncedData));
      console.log('Saved wearable data to localStorage');
    } catch (error) {
      console.error('Error saving wearable data to localStorage:', error);
    }
  }, [currentUser, syncedData]);
  
  // Fetch connected devices
  useEffect(() => {
    async function fetchDevices() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const connectedDevices = await getConnectedDevices(currentUser.uid);
        
        // Create the combined device list with connection status
        const deviceList = AVAILABLE_DEVICES.map(availableDevice => {
          const connectedDevice = connectedDevices.find(d => d.deviceId === availableDevice.id);
          return {
            ...availableDevice,
            connected: !!connectedDevice,
            lastSync: connectedDevice?.lastSync,
            description: connectedDevice?.description || availableDevice.description,
            isTestData: connectedDevice?.isTestData || false,
          };
        });
        
        setDevices(deviceList);
      } catch (error) {
        console.error('Error fetching connected devices:', error);
        // If there's an error, still show the available devices
        setDevices(AVAILABLE_DEVICES.map(d => ({ ...d, connected: false, isTestData: false })));
      } finally {
        setLoading(false);
      }
    }
    
    if (currentUser) {
      fetchDevices();
    } else {
      setLoading(false);
    }
  }, [currentUser]);
  
  // Handle OAuth callback when returning to the page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const oauth = params.get('oauth');
      const device = params.get('device');
      
      if (oauth === 'success' && device && currentUser) {
        // Clear the URL parameters
        window.history.replaceState({}, document.title, '/wearables');
        
        // Show success message
        toast.success(`Authentication successful! ${device} connected.`);
        
        // Refresh device list
        setLoading(true);
        getConnectedDevices(currentUser.uid)
          .then(connectedDevices => {
            // Update devices list with connection status
            setDevices(prev => prev.map(d => {
              const connected = connectedDevices.find(cd => cd.deviceId === d.id);
              if (connected) {
                return {
                  ...d,
                  connected: true,
                  lastSync: connected.lastSync
                };
              }
              return d;
            }));
          })
          .catch(error => console.error('Error fetching devices after OAuth:', error))
          .finally(() => setLoading(false));
      }
      
      if (oauth === 'error') {
        // Clear the URL parameters
        window.history.replaceState({}, document.title, '/wearables');
        
        // Show error message
        toast.error('Authentication failed. Please try again.');
      }
    }
  }, [currentUser]);
  
  // Add new effect to monitor sync status in Firebase
  useEffect(() => {
    if (!currentUser) return;
    
    // Subscribe to sync status updates
    const db = getFirestore();
    const syncStatusRef = doc(db, 'users', currentUser.uid, 'sync_status', 'current');
    
    const unsubscribe = onSnapshot(syncStatusRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSyncStatus({
          status: data.status,
          deviceId: data.deviceId,
          message: data.message,
          dataCounts: data.dataCounts
        });
        
        // If sync completed while away, refresh device list
        if (data.status === 'success') {
          getConnectedDevices(currentUser.uid).then(connectedDevices => {
            const deviceList = AVAILABLE_DEVICES.map(availableDevice => {
              const connectedDevice = connectedDevices.find(d => d.deviceId === availableDevice.id);
              return {
                ...availableDevice,
                connected: !!connectedDevice,
                lastSync: connectedDevice?.lastSync,
                description: connectedDevice?.description || availableDevice.description,
                isTestData: connectedDevice?.isTestData || false,
              };
            });
            setDevices(deviceList);
          });
        }
      }
    });
    
    return () => unsubscribe();
  }, [currentUser]);
  
  // Handle connecting a device
  const handleConnectDevice = (device: DeviceDisplay) => {
    setSelectedDevice(device);
    setShowAuthForm(true);
    setAuthFormData({});
  };
  
  // Handle form input changes
  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthFormData({
      ...authFormData,
      [e.target.name]: e.target.value
    });
  };
  
  // Handle form submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !selectedDevice) return;
    
    try {
      setLoading(true);
      
      const result = await connectDevice(
        currentUser.uid,
        selectedDevice.id,
        authFormData
      );
      
      console.log('Connect device result:', result);
      
      // Check if OAuth is required
      if (result.requiresOAuth && result.authUrl) {
        // Open the OAuth URL in a new window
        toast.success('Please complete authentication in your browser');
        
        // Open the OAuth URL in a new window/tab
        window.open(result.authUrl, '_blank', 'width=600,height=700');
        
        // Set a message to notify the user what to do next
        toast('Complete the authentication in the opened window, then return here.', { 
          duration: 8000
        });
        
        // Close the form since we've opened the OAuth window
        setShowAuthForm(false);
        setSelectedDevice(null);
      }
      else if (result.success) {
        // First, close the form
        setShowAuthForm(false);
        setSelectedDevice(null);
        
        // Get the latest connected devices
        const connectedDevices = await getConnectedDevices(currentUser.uid);
        
        // Update devices list with connection status
        const latestDevices = AVAILABLE_DEVICES.map(availableDevice => {
          const connectedDevice = connectedDevices.find(d => d.deviceId === availableDevice.id);
          return {
            ...availableDevice,
            connected: !!connectedDevice,
            lastSync: connectedDevice?.lastSync,
            description: connectedDevice?.description || availableDevice.description,
            isTestData: connectedDevice?.isTestData || false,
          };
        });
        
        // Update the devices state
        setDevices(latestDevices);

        toast.success(`${selectedDevice.name} connected successfully!`);
        
        // Start syncing immediately using Firebase sync status
        const db = getFirestore();
        const syncStatusRef = doc(db, 'users', currentUser.uid, 'sync_status', 'current');
        
        // Update sync status in Firebase
        await setDoc(syncStatusRef, {
          status: 'syncing',
          deviceId: selectedDevice.id,
          message: `Syncing data from ${getDeviceDisplayName(selectedDevice.id)}...`,
          startedAt: new Date().toISOString()
        });
        
        // Start sync in the background
        syncDeviceData(currentUser.uid, selectedDevice.id)
          .then(async (syncResult) => {
            if (syncResult.success) {
              await setDoc(syncStatusRef, {
                status: 'success',
                deviceId: selectedDevice.id,
                message: syncResult.isTestData 
                  ? `Successfully synced test data from ${getDeviceDisplayName(selectedDevice.id)}`
                  : `Successfully synced data from ${getDeviceDisplayName(selectedDevice.id)}`,
                completedAt: new Date().toISOString(),
                dataCounts: {
                  heartRate: syncResult.data?.heart_rate?.length || 0,
                  steps: syncResult.data?.steps?.length || 0,
                  sleep: syncResult.data?.sleep?.length || 0,
                  activities: syncResult.data?.activities?.length || 0
                }
              });
              
              // Refresh device list again after sync
              const updatedDevices = await getConnectedDevices(currentUser.uid);
              const updatedDeviceList = AVAILABLE_DEVICES.map(availableDevice => {
                const connectedDevice = updatedDevices.find(d => d.deviceId === availableDevice.id);
                return {
                  ...availableDevice,
                  connected: !!connectedDevice,
                  lastSync: connectedDevice?.lastSync,
                  description: connectedDevice?.description || availableDevice.description,
                  isTestData: connectedDevice?.isTestData || false,
                };
              });
              setDevices(updatedDeviceList);
              
              // Set the synced data for visualization
              setSyncedData(syncResult.data);
              
              // Update local state
              setSyncStatus(prev => ({
                ...prev,
                status: 'success',
                message: `Sync completed successfully`,
                dataCounts: {
                  heartRate: syncResult.data?.heart_rate?.length || 0,
                  steps: syncResult.data?.steps?.length || 0,
                  sleep: syncResult.data?.sleep?.length || 0,
                  activities: syncResult.data?.activities?.length || 0
                }
              }));
              
              // Clear sync status after 5 seconds
              setTimeout(async () => {
                await setDoc(syncStatusRef, {
                  status: 'idle',
                  deviceId: '',
                  message: ''
                });
              }, 5000);
            }
          });
      } else {
        toast.error(`Failed to connect ${selectedDevice.name}. ${result.error || 'Please check your credentials.'}`);
      }
    } catch (error) {
      console.error('Error connecting device:', error);
      toast.error('Error connecting device. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle disconnecting a device
  const handleDisconnectDevice = async (deviceId: WearableDevice) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      const success = await disconnectDevice(currentUser.uid, deviceId);
      
      if (success) {
        // Update device status
        setDevices(prev => prev.map(device => 
          device.id === deviceId
            ? { ...device, connected: false, lastSync: undefined }
            : device
        ));
        
        toast.success('Device disconnected successfully.');
      } else {
        toast.error('Failed to disconnect device. Please try again.');
      }
    } catch (error) {
      console.error('Error disconnecting device:', error);
      toast.error('Error disconnecting device. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Modify handleSyncDevice to set hasVisualizationData
  const handleSyncDevice = async (deviceId: WearableDevice) => {
    if (!currentUser) {
      toast.error('You must be logged in to sync device data');
      return;
    }
    
    const db = getFirestore();
    const syncStatusRef = doc(db, 'users', currentUser.uid, 'sync_status', 'current');
    
    try {
      // Update sync status in Firebase
      await setDoc(syncStatusRef, {
        status: 'syncing',
        deviceId: deviceId,
        message: `Syncing data from ${getDeviceDisplayName(deviceId)}...`,
        startedAt: new Date().toISOString()
      });
      
      // Start sync
      const result = await syncDeviceData(currentUser.uid, deviceId);
      
      if (result.success) {
        // Calculate data counts
        const dataCounts = {
          heartRate: result.data?.heart_rate?.length || 0,
          steps: result.data?.steps?.length || 0,
          sleep: result.data?.sleep?.length || 0,
          activities: result.data?.activities?.length || 0
        };
        
        // Update sync status with counts
        await setDoc(syncStatusRef, {
          status: 'success',
          deviceId: deviceId,
          message: result.isTestData 
            ? `Successfully synced test data from ${getDeviceDisplayName(deviceId)}`
            : `Successfully synced data from ${getDeviceDisplayName(deviceId)}`,
          completedAt: new Date().toISOString(),
          dataCounts
        });
        
        // Set the synced data for visualization
        setSyncedData(result.data);
        // Validate the data
        validateSyncedData(result.data);
        // Set flag to show visualizations
        setHasVisualizationData(true);
        // Show debug info automatically after successful sync
        setShowDebugInfo(true);
        
        // Update local state
        setSyncStatus(prev => ({
          ...prev,
          status: 'success',
          message: `Sync completed successfully`,
          dataCounts
        }));
        
        // Clear success status after 30 seconds, but keep visualizations
        setTimeout(async () => {
          await setDoc(syncStatusRef, {
            status: 'idle',
            deviceId: '',
            message: ''
          });
          
          // Update local status but don't clear visualization data
          setSyncStatus({ status: 'idle', deviceId: '', message: '' });
        }, 30000);
      } else {
        await setDoc(syncStatusRef, {
          status: 'error',
          deviceId: deviceId,
          message: result.message || 'Failed to sync data',
          completedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      await setDoc(syncStatusRef, {
        status: 'error',
        deviceId: deviceId,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        completedAt: new Date().toISOString()
      });
    }
  };

  // Add cancel sync function
  const handleCancelSync = async () => {
    if (!currentUser) return;
    
    const db = getFirestore();
    const syncStatusRef = doc(db, 'users', currentUser.uid, 'sync_status', 'current');
    
    try {
      await setDoc(syncStatusRef, {
        status: 'idle',
        deviceId: '',
        message: ''
      });
      setSyncStatus({ status: 'idle', deviceId: '', message: '' });
    } catch (error) {
      console.error('Error canceling sync:', error);
      toast.error('Failed to cancel sync');
    }
  };

  // Add a function to validate data and update the debug state
  const validateSyncedData = (data: any) => {
    if (!data) {
      setDataValidation({
        hasHeartRateData: false,
        hasStepData: false,
        hasSleepData: false,
        hasAnyValidData: false
      });
      return;
    }

    // Determine where to look for data
    const dataSource = data.categories && typeof data.categories === 'object' ? data.categories : data;
    
    // Get data for each category
    const heartRateData = dataSource.heartrate || dataSource.heart_rate || [];
    const stepData = dataSource.steps || [];
    const sleepData = dataSource.sleep || [];
    
    // Validate data structure for each type
    const isValidHeartRateData = heartRateData.length > 0 && heartRateData.every((item: any) => 
      item && typeof item === 'object' && 
      (item.dateTime || item.timestamp || item.date) && 
      typeof item.value === 'number'
    );
    
    const isValidStepData = stepData.length > 0 && stepData.every((item: any) =>
      item && typeof item === 'object' &&
      (item.dateTime || item.timestamp || item.date) &&
      (typeof item.value === 'number' || typeof item.steps === 'number')
    );
    
    const isValidSleepData = sleepData.length > 0 && sleepData.every((item: any) =>
      item && typeof item === 'object' &&
      (item.dateTime || item.timestamp || item.date)
    );
    
    const hasAnyValidData = isValidHeartRateData || isValidStepData || isValidSleepData;
    
    setDataValidation({
      hasHeartRateData: isValidHeartRateData,
      hasStepData: isValidStepData,
      hasSleepData: isValidSleepData,
      hasAnyValidData
    });
  };

  // Update the syncDevice function too
  const syncDevice = async (device: DeviceDisplay) => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);
      setSyncStatus({
        status: 'syncing',
        deviceId: device.id,
        message: `Syncing data from ${device.name}...`
      });
      
      const result = await syncDeviceData(currentUser.uid, device.id);
      
      if (result.success) {
        // If sync was successful and we got data
        if (result.data) {
          setSyncedData(result.data);
          // Add validation step here
          validateSyncedData(result.data);
          setShowDebugInfo(true); // Show debug panel automatically on successful sync
          setHasVisualizationData(true); // Set flag to show visualizations
          
          // Store the data in localStorage for persistence
          try {
            const dataKey = `wearable_data_${currentUser.uid}`;
            localStorage.setItem(dataKey, JSON.stringify(result.data));
            console.log('Saved new wearable data to localStorage');
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
          
          // Update status with counts
          const dataSource = result.data.categories && typeof result.data.categories === 'object' 
            ? result.data.categories : result.data;
            
          const heartRateCount = (dataSource.heartrate || dataSource.heart_rate || []).length;
          const stepsCount = (dataSource.steps || []).length;
          const sleepCount = (dataSource.sleep || []).length;
          const activitiesCount = (dataSource.activities || []).length;
          
          setSyncStatus({
            status: 'success',
            deviceId: device.id,
            message: `Successfully synced ${result.observationCount || 0} observations from ${device.name}`,
            dataCounts: {
              heartRate: heartRateCount,
              steps: stepsCount,
              sleep: sleepCount,
              activities: activitiesCount
            }
          });
        } else {
          setSyncStatus({
            status: 'warning',
            deviceId: device.id,
            message: `Successfully connected to ${device.name}, but no data was returned`
          });
        }
      } else {
        setSyncStatus({
          status: 'error',
          deviceId: device.id,
          message: result.message || `Failed to sync data from ${device.name}`
        });
      }
    } catch (error) {
      setSyncStatus({
        status: 'error',
        deviceId: device.id,
        message: error instanceof Error ? error.message : 'Unknown error during sync'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render data for a specific category
  const renderCategoryData = (categoryData: any) => {
    console.log('Rendering category data:', categoryData);
    
    if (!categoryData) {
      return <p className="text-gray-400">No data available for this category.</p>;
    }
    
    if (categoryData.error) {
      return <p className="text-red-400">Error: {categoryData.error}</p>;
    }
    
    if (!Array.isArray(categoryData)) {
      return (
        <div className="bg-gray-800 p-3 rounded">
          <p className="text-gray-400 mb-2">Non-array data format:</p>
          <pre className="text-xs overflow-auto text-gray-300">
            {JSON.stringify(categoryData, null, 2)}
          </pre>
        </div>
      );
    }
    
    if (categoryData.length === 0) {
      return <p className="text-gray-400">No records found for this category.</p>;
    }
    
    return (
      <div className="mt-4 overflow-auto max-h-96">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              {Object.keys(categoryData[0]).map(key => (
                <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {categoryData.map((item: any, index: number) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                {Object.entries(item).map(([key, value]) => (
                  <td key={key} className="px-4 py-2 text-sm text-gray-300">
                    {typeof value === 'object' 
                      ? JSON.stringify(value) 
                      : String(value)
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Display a summary of the data received
  const renderDataSummary = () => {
    if (!syncedData) return null;
    
    // Extract only the data categories (filter out metadata properties)
    const dataCategories = Object.keys(syncedData).filter(key => 
      Array.isArray(syncedData[key]) && 
      !['deviceId', 'deviceName', 'syncTime', 'isTestData', 'observationCount'].includes(key)
    );
    
    return (
      <div className="mb-4 bg-gray-900/50 p-3 rounded text-sm">
        <h4 className="text-gray-300 font-medium mb-2">Data Summary:</h4>
        <ul className="list-disc pl-5 text-gray-400">
          {dataCategories.length > 0 ? dataCategories.map(cat => {
            const data = syncedData[cat];
            const count = Array.isArray(data) ? data.length : 'N/A';
            return (
              <li key={cat}>
                {cat}: {count} records
              </li>
            );
          }) : (
            <li>No data categories found. FHIR Resources generated: {syncedData.observationCount || 0} observations</li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <PageLayout 
        title="My Wearables"
        isHomePage={true}
      >
        <p className="mb-6 text-gray-300">
          Connect your wearable devices to automatically import health data.
        </p>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Add New Device Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSelectedDevice(null);
                  setShowAuthForm(true);
                }}
                className="px-6 py-3 rounded-md transition-colors text-white border border-primary-blue hover:bg-black/20 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Device
              </button>
            </div>

            {/* Connected Devices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {devices.filter(device => device.connected).map(device => (
                <div key={device.id} className="bg-black/80 backdrop-blur-sm p-4 rounded-md shadow-md flex flex-col border border-gray-800">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mr-4">
                      {/* Placeholder for device logo */}
                      <span className="text-xl font-bold text-gray-400">{device.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-primary-blue">{device.name}</h3>
                      <p className="text-sm text-gray-400">
                        {device.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-green-800 text-green-200 px-2 py-1 rounded-full text-xs">
                    Connected
                  </div>
                  
                  <div className="mb-4 text-xs text-gray-500">
                    Last synced: {device.lastSync ? new Date(device.lastSync).toLocaleString() : 'Never'}
                    {device.isTestData && (
                      <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/50 text-yellow-400 rounded">Test Data</span>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => syncDevice(device)}
                      disabled={syncStatus.status === 'syncing' && syncStatus.deviceId === device.id}
                      className="px-4 py-2 rounded-md transition-colors text-white border border-primary-blue hover:bg-black/20 flex items-center justify-center"
                    >
                      {syncStatus.status === 'syncing' && syncStatus.deviceId === device.id ? (
                        <>
                          <span className="w-4 h-4 border-t-2 border-r-2 border-white rounded-full animate-spin mr-2"></span>
                          Syncing...
                        </>
                      ) : (
                        'Sync Now'
                      )}
                    </button>
                    {syncStatus.status === 'syncing' && syncStatus.deviceId === device.id && (
                      <button
                        onClick={handleCancelSync}
                        className="px-4 py-2 rounded-md transition-colors bg-red-900/50 text-red-300 hover:bg-red-800/50"
                      >
                        Cancel Sync
                      </button>
                    )}
                    <button
                      onClick={() => handleDisconnectDevice(device.id)}
                      disabled={syncStatus.status === 'syncing' && syncStatus.deviceId === device.id}
                      className="px-4 py-2 rounded-md transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Device Selection Modal */}
        {showAuthForm && !selectedDevice && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-primary-blue mb-4">
                Add New Device
              </h2>
              
              <div className="space-y-4">
                {AVAILABLE_DEVICES.filter(device => !devices.find(d => d.connected && d.id === device.id)).map(device => (
                  <button
                    key={device.id}
                    onClick={() => handleConnectDevice({
                      ...device,
                      connected: false,
                      isTestData: false
                    })}
                    className="w-full p-4 rounded-md transition-colors bg-gray-800 hover:bg-gray-700 text-left flex items-center"
                  >
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center mr-4">
                      <span className="text-lg font-bold text-gray-400">{device.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-primary-blue">{device.name}</h3>
                      <p className="text-sm text-gray-400">{device.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowAuthForm(false)}
                className="mt-6 w-full px-4 py-2 rounded-md transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Authentication Form Modal */}
        {showAuthForm && selectedDevice && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-primary-blue mb-4">
                Connect {selectedDevice.name}
              </h2>
              
              <p className="text-gray-400 mb-4">
                Please enter your {selectedDevice.name} account credentials to connect your device.
              </p>
              
              {selectedDevice.id === 'fitbit/versa' && (
                <div className="mb-4 p-3 bg-gray-800 rounded-md text-sm">
                  <h3 className="text-primary-blue font-medium mb-2">How to get Fitbit API credentials:</h3>
                  <ol className="list-decimal text-gray-300 pl-5 space-y-1">
                    <li>Visit the <a href="https://dev.fitbit.com/apps/new" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:underline">Fitbit Developer Portal</a></li>
                    <li>Log in with your Fitbit account</li>
                    <li>Register a new application</li>
                    <li>Set OAuth 2.0 Application Type to "Personal"</li>
                    <li>Set Callback URL to: <code className="bg-gray-900 px-1 py-0.5 rounded text-xs">http://localhost:3001/auth/fitbit/callback</code></li>
                    <li>Once created, copy the Client ID and Client Secret</li>
                  </ol>
                </div>
              )}
              
              <form onSubmit={handleAuthSubmit}>
                {selectedDevice.authFields.map(field => (
                  <div key={field.name} className="mb-4">
                    <label htmlFor={field.name} className="block text-sm font-medium text-gray-300 mb-1">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      id={field.name}
                      name={field.name}
                      value={authFormData[field.name] || ''}
                      onChange={handleAuthInputChange}
                      placeholder={field.placeholder}
                      required
                      className="bg-gray-900 block w-full rounded-md border-gray-600 border px-4 py-3 text-white placeholder-gray-500 focus:border-primary-blue focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </div>
                ))}
                
                <div className="mb-6 mt-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useTestData"
                      name="useTestData"
                      checked={!!authFormData.useTestData}
                      onChange={(e) => setAuthFormData({
                        ...authFormData,
                        useTestData: e.target.checked
                      })}
                      className="h-4 w-4 text-primary-blue focus:ring-primary-blue border-gray-600 rounded bg-gray-800"
                    />
                    <label htmlFor="useTestData" className="ml-2 block text-sm text-gray-300">
                      Use test data (no real credentials needed)
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    When checked, this option uses Wearipedia's test data generation feature instead of connecting to a real device.
                  </p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthForm(false);
                      setSelectedDevice(null);
                    }}
                    className="px-4 py-2 rounded-md text-gray-300 border border-gray-700 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md text-white border border-primary-blue hover:bg-black/20"
                  >
                    Connect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Visualizations - change condition to use hasVisualizationData */}
        {syncedData && hasVisualizationData && (
          <div className="mt-8">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
            
            {showDebugInfo && (
              <div className="mb-8 p-4 bg-gray-800 rounded-lg text-sm overflow-auto">
                <h3 className="text-lg font-semibold text-white mb-2">Debug Information</h3>
                
                <div className="mb-4">
                  <h4 className="text-primary-blue font-medium">Data Validation Results:</h4>
                  <ul className="mt-2 space-y-1 text-gray-300">
                    <li>Heart Rate Data: <span className={dataValidation.hasHeartRateData ? "text-green-400" : "text-red-400"}>
                      {dataValidation.hasHeartRateData ? "✓ Valid" : "✗ Invalid or Missing"}
                    </span></li>
                    <li>Step Data: <span className={dataValidation.hasStepData ? "text-green-400" : "text-red-400"}>
                      {dataValidation.hasStepData ? "✓ Valid" : "✗ Invalid or Missing"}
                    </span></li>
                    <li>Sleep Data: <span className={dataValidation.hasSleepData ? "text-green-400" : "text-red-400"}>
                      {dataValidation.hasSleepData ? "✓ Valid" : "✗ Invalid or Missing"}
                    </span></li>
                    <li className="font-medium">Any Valid Data: <span className={dataValidation.hasAnyValidData ? "text-green-400" : "text-red-400"}>
                      {dataValidation.hasAnyValidData ? "✓ Yes" : "✗ No"}
                    </span></li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-primary-blue font-medium">Data Counts:</h4>
                  <ul className="mt-2 space-y-1 text-gray-300">
                    <li>Heart Rate: {syncStatus.dataCounts?.heartRate ?? 0} records</li>
                    <li>Steps: {syncStatus.dataCounts?.steps ?? 0} records</li>
                    <li>Sleep: {syncStatus.dataCounts?.sleep ?? 0} records</li>
                    <li>Activities: {syncStatus.dataCounts?.activities ?? 0} records</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-primary-blue font-medium">Raw Synced Data:</h4>
                  <div className="mt-2 bg-gray-900 p-2 rounded-md max-h-80 overflow-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(syncedData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            
            <WearableDataDashboard syncedData={syncedData} />
          </div>
        )}
      </PageLayout>
    </ProtectedRoute>
  );
} 