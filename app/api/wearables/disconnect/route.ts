import { NextRequest, NextResponse } from 'next/server';
import { WearableDevice, getDeviceDisplayName } from '../../../lib/wearable-service';

/**
 * POST handler for disconnecting a wearable device
 * This is a simulated implementation that pretends to disconnect a device
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Disconnect API called');
    
    // Parse the request body
    const { userId, deviceId } = await request.json();
    
    console.log(`Disconnecting device ${deviceId} for user ${userId}`);
    
    if (!userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing userId or deviceId parameter', success: false },
        { status: 400 }
      );
    }
    
    // Get device name for display purposes
    const deviceName = getDeviceDisplayName(deviceId as WearableDevice);
    
    // Simulate a processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // A more realistic implementation would update the database
    // to remove the device connection
    
    // For now, just pretend it worked
    const response = {
      success: true,
      message: `Successfully disconnected from ${deviceName}`,
      deviceId
    };
    
    console.log('Returning response:', response);
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error disconnecting device:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error', 
        success: false,
        message: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
} 