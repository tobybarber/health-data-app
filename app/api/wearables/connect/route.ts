import { NextRequest, NextResponse } from 'next/server';
import { WearableDevice, getDeviceDisplayName } from '../../../lib/wearable-service';

/**
 * POST handler for connecting a wearable device
 * This is a simulated implementation that pretends to connect a device
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Connect API called');
    
    // Parse the request body
    const { userId, deviceId, credentials } = await request.json();
    
    console.log(`Connecting device ${deviceId} for user ${userId}`);
    
    if (!userId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing userId or deviceId parameter', success: false },
        { status: 400 }
      );
    }
    
    if (!credentials || Object.keys(credentials).length === 0) {
      return NextResponse.json(
        { error: 'Missing credentials', success: false },
        { status: 400 }
      );
    }
    
    // Simulate authentication validation
    // In a real implementation, this would call the appropriate API
    // or use the Wearipedia library to validate credentials
    
    // Get device name for display purposes
    const deviceName = getDeviceDisplayName(deviceId as WearableDevice);
    
    // Simulate a processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // A more realistic implementation would store the encrypted credentials
    // and device connection status in a database
    
    // For now, just pretend everything worked - ALWAYS return success for testing
    const response = {
      success: true,
      message: `Successfully connected to ${deviceName}`,
      deviceId,
      connected: true,
      lastSync: null
    };
    
    console.log('Returning response:', response);
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error connecting device:', error);
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

/**
 * DELETE handler for disconnecting a wearable device
 */
export async function DELETE(request: NextRequest) {
  try {
    // Extract parameters from the URL
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const deviceId = url.searchParams.get('deviceId');
    
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
    return NextResponse.json({
      success: true,
      message: `Successfully disconnected from ${deviceName}`,
      deviceId
    });
  } catch (error: any) {
    console.error('Error disconnecting device:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
} 