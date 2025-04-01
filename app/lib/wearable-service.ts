'use client';

import { v4 as uuidv4 } from 'uuid';
import { WearipediaClient, DeviceCredentials } from './wearipedia-client';
import { WearableFhirConverter } from './wearable-fhir-converter';
import { Firestore, collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getFirestore } from '../firebase/firebase-config';

// Initialize the clients
const wearipediaClient = new WearipediaClient();
const fhirConverter = new WearableFhirConverter();

/**
 * Supported wearable device types
 * Based on Wearipedia's supported devices
 */
export type WearableDevice = 
  | 'whoop/whoop_4'
  | 'garmin/fenix_7s'
  | 'dexcom/pro_cgm'
  | 'withings/bodyplus'
  | 'withings/scanwatch'
  | 'fitbit/versa';

/**
 * Map of device types to their data categories
 */
export const deviceDataCategories: Record<WearableDevice, string[]> = {
  'whoop/whoop_4': ['cycles', 'hr'],
  'garmin/fenix_7s': ['steps', 'heart_rate'],
  'dexcom/pro_cgm': ['dataframe'],
  'withings/bodyplus': ['measurements'],
  'withings/scanwatch': ['heart_rate', 'sleep'],
  'fitbit/versa': ['activities', 'heart_rate', 'sleep']
};

/**
 * Interface for device information
 */
export interface DeviceInfo {
  deviceId: WearableDevice;
  connected: boolean;
  lastSync?: Date;
  name: string;
  description: string;
  isTestData?: boolean;
}

/**
 * Get connected devices for a user
 */
export async function getConnectedDevices(userId: string): Promise<DeviceInfo[]> {
  try {
    // Get device connections from Firestore
    const db = getFirestore();
    const devicesQuery = query(
      collection(db, 'users', userId, 'devices')
    );
    
    const querySnapshot = await getDocs(devicesQuery);
    if (querySnapshot.empty) {
      return [];
    }
    
    // Transform the device data to include names and descriptions
    const connectedDevices = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Use the stored deviceId from the document data instead of trying to parse the document ID
      return {
        deviceId: data.deviceId as WearableDevice,
        connected: true,
        lastSync: data.lastSync ? new Date(data.lastSync) : undefined,
        isTestData: data.isTestData || false
      };
    });
    
    return connectedDevices.map((device) => ({
      ...device,
      name: getDeviceDisplayName(device.deviceId),
      description: getDeviceDescription(device.deviceId)
    }));
  } catch (error) {
    console.error('Error fetching connected devices:', error);
    return [];
  }
}

/**
 * Connect a device for a user
 */
export async function connectDevice(
  userId: string, 
  deviceId: WearableDevice,
  credentials: Record<string, any>
): Promise<{
  success: boolean;
  requiresOAuth?: boolean;
  authUrl?: string;
  message?: string;
  error?: string;
  isTestData?: boolean;
}> {
  try {
    console.log(`Connecting device ${deviceId} for user ${userId}...`);
    
    // Extract useTestData from credentials
    const { useTestData, authCode, redirectUri, ...otherCredentials } = credentials;
    
    // Handle OAuth if required
    if (!useTestData && !authCode && redirectUri) {
      // Get the auth URL for the device
      const authUrl = await wearipediaClient.getAuthUrl(deviceId, redirectUri);
      
      if (!authUrl) {
        return {
          success: false,
          error: 'Failed to get OAuth URL for device'
        };
      }
      
      return {
        success: false,
        requiresOAuth: true,
        authUrl
      };
    }
    
    // Connect to the device
    const deviceCredentials = await wearipediaClient.connectDevice(deviceId, !!useTestData, authCode);
    
    if (!deviceCredentials) {
      return {
        success: false,
        error: 'Failed to connect to device'
      };
    }
    
    // Store device credentials in Firestore
    const db = getFirestore();
    // Create a sanitized device ID for the document path (replace slashes with underscores)
    const sanitizedDeviceId = deviceId.replace(/\//g, '_');
    const deviceDocRef = doc(collection(db, 'users', userId, 'devices'), sanitizedDeviceId);
    
    // Save to Firestore, merging the properties
    await setDoc(deviceDocRef, {
      ...deviceCredentials,
      deviceId, // Keep the original deviceId in the document data
      userId,
      connectedAt: new Date().toISOString(),
    });
    
    return {
      success: true,
      message: `Successfully connected to ${getDeviceDisplayName(deviceId)}`,
      isTestData: !!useTestData
    };
  } catch (error) {
    console.error('Error connecting device:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error connecting device' 
    };
  }
}

/**
 * Disconnect a device
 */
export async function disconnectDevice(
  userId: string,
  deviceId: WearableDevice
): Promise<boolean> {
  try {
    console.log(`Disconnecting device ${deviceId} for user ${userId}...`);
    
    // Fix: Use the same sanitized device ID format
    const sanitizedDeviceId = deviceId.replace(/\//g, '_');
    
    // Get device credentials from Firestore
    const db = getFirestore();
    const deviceDocRef = doc(collection(db, 'users', userId, 'devices'), sanitizedDeviceId);
    const deviceDoc = await getDoc(deviceDocRef);
    
    if (!deviceDoc.exists()) {
      console.error('Device not found');
      return false;
    }
    
    const credentials = deviceDoc.data() as DeviceCredentials;
    
    // Disconnect from Wearipedia if not test data
    if (!credentials.isTestData) {
      const disconnected = await wearipediaClient.disconnectDevice(credentials);
      
      if (!disconnected) {
        console.error('Failed to disconnect from Wearipedia API');
        // Continue anyway to clean up local state
      }
    }
    
    // Remove device from Firestore
    await deleteDoc(deviceDocRef);
    
    return true;
  } catch (error) {
    console.error('Error disconnecting device:', error);
    return false;
  }
}

/**
 * Sync data from a device
 */
export async function syncDeviceData(
  userId: string,
  deviceId: WearableDevice
): Promise<{
  success: boolean;
  message?: string;
  observationCount?: number;
  data?: any;
  isTestData?: boolean;
}> {
  try {
    console.log(`[SYNC] Starting sync for device ${deviceId} and user ${userId}...`);
    
    // Fix: Use the same sanitized device ID format
    const sanitizedDeviceId = deviceId.replace(/\//g, '_');
    console.log(`[SYNC] Using sanitized device ID: ${sanitizedDeviceId}`);
    
    // Get device credentials from Firestore
    const db = getFirestore();
    const deviceDocRef = doc(collection(db, 'users', userId, 'devices'), sanitizedDeviceId);
    const deviceDoc = await getDoc(deviceDocRef);
    
    if (!deviceDoc.exists()) {
      console.log(`[SYNC] Device not found in Firestore`);
      return {
        success: false,
        message: 'Device not connected'
      };
    }
    
    const credentials = deviceDoc.data() as DeviceCredentials;
    console.log(`[SYNC] Retrieved device credentials, isTestData: ${credentials.isTestData}`);
    
    // Calculate date range - last 7 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`[SYNC] Date range: ${startDate} to ${endDate}`);
    
    // Sync data from Wearipedia
    console.log(`[SYNC] Calling Wearipedia client to sync data...`);
    const syncResult = await wearipediaClient.syncDeviceData(credentials, startDate, endDate);
    
    if (!syncResult.success) {
      console.log(`[SYNC] Wearipedia sync failed: ${syncResult.error}`);
      return {
        success: false,
        message: syncResult.error || 'Failed to sync data',
        isTestData: credentials.isTestData
      };
    }
    
    console.log(`[SYNC] Wearipedia sync successful, updating last sync time...`);
    // Update last sync time in Firestore
    await updateDoc(deviceDocRef, {
      lastSync: new Date().toISOString()
    });
    
    // Process and store FHIR data
    console.log(`[SYNC] Processing data through FHIR converter...`);
    // Process the raw data into FHIR resources
    const processedData = await fhirConverter.processWearableData(
      syncResult.data,
      credentials,
      userId  // Use userId directly instead of patientId
    );
    
    console.log(`[SYNC] Storing FHIR resources in Firestore...`);
    // Store FHIR resources in Firestore
    await storeWearableFhirData(db, userId, processedData);
    
    console.log(`[SYNC] Sync completed successfully with ${processedData.observations.length} observations`);
    return {
      success: true,
      message: `Successfully synced data from ${getDeviceDisplayName(deviceId)}`,
      observationCount: processedData.observations.length,
      data: syncResult.data,
      isTestData: credentials.isTestData
    };
  } catch (error) {
    console.error('[SYNC] Error during sync:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Store FHIR resources from wearable data
 */
async function storeWearableFhirData(
  db: Firestore,
  userId: string,
  processedData: any
): Promise<void> {
  try {
    // Store observations
    for (const observation of processedData.observations) {
      const obsId = observation.id || uuidv4();
      observation.id = obsId;
      
      // Store only in users collection with consistent resource ID format
      await setDoc(
        doc(db, 'users', userId, 'fhir_resources', `Observation_${obsId}`),
        observation
      );
    }
    
    // Store diagnostic reports
    for (const report of processedData.reports) {
      const reportId = report.id || uuidv4();
      report.id = reportId;
      
      // Store only in users collection with consistent resource ID format
      await setDoc(
        doc(db, 'users', userId, 'fhir_resources', `DiagnosticReport_${reportId}`),
        report
      );
    }
    
    console.log(`Stored ${processedData.observations.length} observations and ${processedData.reports.length} reports in Firestore`);
  } catch (error) {
    console.error('Error storing FHIR data:', error);
    throw error;
  }
}

/**
 * Get device name from ID
 */
export function getDeviceDisplayName(deviceId: WearableDevice): string {
  const deviceMap: Record<WearableDevice, string> = {
    'whoop/whoop_4': 'Whoop 4.0',
    'garmin/fenix_7s': 'Garmin Fenix 7S',
    'dexcom/pro_cgm': 'Dexcom CGM',
    'withings/bodyplus': 'Withings Body+',
    'withings/scanwatch': 'Withings ScanWatch',
    'fitbit/versa': 'Fitbit Versa'
  };
  
  return deviceMap[deviceId] || deviceId;
}

/**
 * Get device description from ID
 */
export function getDeviceDescription(deviceId: WearableDevice): string {
  const descriptionMap: Record<WearableDevice, string> = {
    'whoop/whoop_4': 'Fitness and recovery wearable',
    'garmin/fenix_7s': 'GPS multisport smartwatch',
    'dexcom/pro_cgm': 'Continuous Glucose Monitor',
    'withings/bodyplus': 'Smart scale with body composition',
    'withings/scanwatch': 'Hybrid smartwatch with ECG',
    'fitbit/versa': 'Fitness and health smartwatch'
  };
  
  return descriptionMap[deviceId] || 'Wearable device';
} 