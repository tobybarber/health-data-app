import { NextRequest, NextResponse } from 'next/server';
import { WearableDevice, DeviceInfo } from '../../../lib/wearable-service';

/**
 * GET handler for fetching connected wearable devices
 */
export async function GET(request: NextRequest) {
  try {
    // Extract user ID from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }
    
    // In a real implementation, this would fetch data from a database
    // For now, return mock data to simulate the API
    
    // Simulate a small delay to mimic a real API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return an empty array initially - users will "connect" devices in the UI
    const devices: DeviceInfo[] = [];
    
    return NextResponse.json({ 
      devices,
      success: true
    });
  } catch (error: any) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 