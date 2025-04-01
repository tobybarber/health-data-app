/**
 * Wearipedia Client - Direct browser integration with Wearipedia
 *
 * This module provides utilities to connect with and fetch data from wearable devices
 * using the Wearipedia API directly from the browser.
 */

import axios from 'axios';

// Wearipedia API base URL
const WEARIPEDIA_API_URL = 'https://api.wearipedia.dev/api/v1';

// Types for Wearipedia API responses
export interface WearipediaDevice {
  id: string;
  name: string;
  description: string;
  requiresAuth: boolean;
  scopes?: string[];
  authUrl?: string;
}

export interface DeviceCredentials {
  deviceId: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  deviceUserId?: string;
  expires?: number;
  isTestData?: boolean;
}

export interface DeviceData {
  [key: string]: any[];
}

export interface SyncResult {
  success: boolean;
  data: DeviceData;
  error?: string;
  isTestData?: boolean;
}

export class WearipediaClient {
  /**
   * Get all available devices from Wearipedia
   */
  async getAvailableDevices(): Promise<WearipediaDevice[]> {
    try {
      const response = await axios.get(`${WEARIPEDIA_API_URL}/devices`);
      return response.data.devices || [];
    } catch (error) {
      console.error('Error fetching available devices:', error);
      return [];
    }
  }

  /**
   * Connect to a device (real or using test data)
   */
  async connectDevice(deviceId: string, useTestData: boolean = false, authCode?: string): Promise<DeviceCredentials | null> {
    try {
      // For test data, we create a mock credential
      if (useTestData) {
        return {
          deviceId,
          accessToken: 'test_access_token',
          userId: 'test_user_id',
          deviceUserId: `test_${deviceId}_${Date.now()}`,
          isTestData: true
        };
      }

      // For real connections
      if (!authCode) {
        console.error('Auth code is required for real device connections');
        return null;
      }

      const response = await axios.post(`${WEARIPEDIA_API_URL}/devices/${deviceId}/connect`, {
        code: authCode
      });

      if (response.data.success) {
        return {
          deviceId,
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          userId: response.data.user_id,
          deviceUserId: response.data.device_user_id,
          expires: response.data.expires,
          isTestData: false
        };
      }

      return null;
    } catch (error) {
      console.error(`Error connecting to device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Get the OAuth URL for device authorization
   */
  async getAuthUrl(deviceId: string, redirectUri: string): Promise<string | null> {
    try {
      const response = await axios.get(`${WEARIPEDIA_API_URL}/devices/${deviceId}/auth-url`, {
        params: { redirect_uri: redirectUri }
      });
      
      return response.data.auth_url || null;
    } catch (error) {
      console.error(`Error getting auth URL for device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Sync data from a device (real or test data)
   */
  async syncDeviceData(credentials: DeviceCredentials, startDate?: string, endDate?: string): Promise<SyncResult> {
    try {
      // For test data generation
      if (credentials.isTestData) {
        return {
          success: true,
          data: this.generateTestData(),
          isTestData: true
        };
      }

      // For real device data
      if (!credentials.accessToken) {
        return {
          success: false,
          data: {},
          error: 'No access token available',
          isTestData: false
        };
      }

      // Calculate date range if not provided
      const end = endDate || new Date().toISOString().split('T')[0];
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await axios.post(`${WEARIPEDIA_API_URL}/devices/${credentials.deviceId}/sync`, {
        access_token: credentials.accessToken,
        user_id: credentials.userId,
        device_user_id: credentials.deviceUserId,
        start_date: start,
        end_date: end
      });

      return {
        success: true,
        data: response.data,
        isTestData: false
      };
    } catch (error) {
      console.error('Error syncing device data:', error);
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        isTestData: credentials.isTestData
      };
    }
  }

  /**
   * Disconnect a device
   */
  async disconnectDevice(credentials: DeviceCredentials): Promise<boolean> {
    // For test data, just return true
    if (credentials.isTestData) {
      return true;
    }

    try {
      if (!credentials.accessToken) {
        console.error('No access token available for disconnect');
        return false;
      }

      const response = await axios.post(`${WEARIPEDIA_API_URL}/devices/${credentials.deviceId}/disconnect`, {
        access_token: credentials.accessToken,
        user_id: credentials.userId,
        device_user_id: credentials.deviceUserId
      });

      return response.data.success || false;
    } catch (error) {
      console.error('Error disconnecting device:', error);
      return false;
    }
  }

  /**
   * Generate test data for different metrics
   */
  private generateTestData(): DeviceData {
    console.log('Generating test data...');
    const now = new Date();
    const data: DeviceData = {
      heart_rate: [],
      steps: [],
      sleep: [],
      activities: []
    };

    // Generate 24 hours of heart rate data, every 5 minutes
    console.log('Generating heart rate data...');
    for (let i = 0; i < 24 * 12; i++) {
      const date = new Date(now.getTime() - (24 * 60 * 60 * 1000) - (i * 5 * 60 * 1000)); // Start from yesterday
      data.heart_rate.push({
        dateTime: date.toISOString(),
        value: Math.round(70 + Math.sin(i / 12) * 10 + (Math.random() * 10 - 5))
      });
    }
    console.log(`Generated ${data.heart_rate.length} heart rate entries`);

    // Generate 7 days of step data
    console.log('Generating step data...');
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - ((i + 1) * 24 * 60 * 60 * 1000)); // Start from yesterday
      const steps = Math.round(5000 + Math.random() * 10000);
      
      data.steps.push({
        dateTime: date.toISOString(),
        value: steps,
        distance: Math.round(steps * 0.0008 * 100) / 100, // approx distance in km
        calories: Math.round(steps * 0.05) // approx calories
      });
    }
    console.log(`Generated ${data.steps.length} step entries`);

    // Generate 7 days of sleep data
    console.log('Generating sleep data...');
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - ((i + 1) * 24 * 60 * 60 * 1000)); // Start from yesterday
      const deepSleep = Math.round(60 + Math.random() * 120); // 1-3 hours of deep sleep
      const remSleep = Math.round(90 + Math.random() * 90); // 1.5-3 hours of REM sleep
      const lightSleep = Math.round(180 + Math.random() * 120); // 3-5 hours of light sleep
      const totalSleep = deepSleep + remSleep + lightSleep;
      
      data.sleep.push({
        dateTime: date.toISOString(),
        duration: totalSleep,
        deep: deepSleep,
        light: lightSleep,
        rem: remSleep,
        awake: Math.round(Math.random() * 30) // 0-30 minutes awake
      });
    }
    console.log(`Generated ${data.sleep.length} sleep entries`);

    // Generate 10 random activities
    console.log('Generating activity data...');
    const activityTypes = ['walking', 'running', 'cycling', 'swimming', 'hiking'];
    for (let i = 0; i < 10; i++) {
      const dayOffset = Math.floor(Math.random() * 7); // Random day in the last week
      const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const duration = Math.round(10 + Math.random() * 110); // 10-120 minutes
      const distance = Math.round(duration * (0.1 + Math.random() * 0.2) * 100) / 100; // Variable pace
      const calories = Math.round(duration * (5 + Math.random() * 10)); // Variable intensity
      
      data.activities.push({
        dateTime: date.toISOString(),
        type: activityType,
        duration,
        distance,
        calories,
        avg_heart_rate: Math.round(110 + Math.random() * 50) // 110-160 bpm
      });
    }
    console.log(`Generated ${data.activities.length} activity entries`);
    console.log('Test data generation complete');

    return data;
  }
} 