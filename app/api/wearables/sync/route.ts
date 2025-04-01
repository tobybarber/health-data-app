import { NextRequest, NextResponse } from 'next/server';
import { WearableDevice, getDeviceDisplayName } from '../../../lib/wearable-service';

/**
 * POST handler for syncing wearable device data
 * This is a simulated implementation that returns mock data
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { userId, deviceId, dataCategories = [] } = await request.json();
    
    if (!userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing userId or deviceId parameter', success: false },
        { status: 400 }
      );
    }
    
    // Get device name for display purposes
    const deviceName = getDeviceDisplayName(deviceId as WearableDevice);
    
    // Simulate a processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate mock response data
    const mockData: Record<string, any[]> = {};
    
    // Generate different mock data based on the device type and data categories
    if (dataCategories.length === 0 || dataCategories.includes('hr') || dataCategories.includes('heart_rate')) {
      // Generate mock heart rate data
      mockData['heart_rate'] = Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: Math.floor(Math.random() * 30) + 60 // Random HR between 60-90
      }));
    }
    
    if (dataCategories.length === 0 || dataCategories.includes('steps')) {
      // Generate mock step data
      mockData['steps'] = Array.from({ length: 3 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        value: Math.floor(Math.random() * 5000) + 3000 // Random steps between 3000-8000
      }));
    }
    
    if (dataCategories.length === 0 || 
        dataCategories.includes('sleep') || 
        dataCategories.includes('sleeps') ||
        dataCategories.includes('cycles')) {
      // Generate mock sleep data
      mockData['sleep'] = Array.from({ length: 3 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        duration: Math.floor(Math.random() * 120) + 360 // Random sleep duration between 360-480 minutes
      }));
    }
    
    if (deviceId === 'dexcom/pro_cgm' && 
        (dataCategories.length === 0 || dataCategories.includes('dataframe'))) {
      // Generate mock glucose data for Dexcom
      mockData['glucose'] = Array.from({ length: 8 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 1800000).toISOString(), // Every 30 min
        value: Math.floor(Math.random() * 40) + 80 // Random glucose between 80-120 mg/dL
      }));
    }
    
    // Return the mock data
    return NextResponse.json({
      success: true,
      deviceId,
      deviceName,
      totalObservations: Object.values(mockData).reduce((sum, arr) => sum + arr.length, 0),
      data: mockData
    });
  } catch (error: any) {
    console.error('Error syncing device data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 