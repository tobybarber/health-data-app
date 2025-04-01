# Wearipedia Integration

## Overview

The Health Data App integrates with Wearipedia to connect to various wearable devices and fetch health data. The integration is implemented entirely in JavaScript/TypeScript, running directly in the browser without requiring any server-side Python components.

## What is Wearipedia?

[Wearipedia](https://wearipedia.net/) is a project that provides standardized access to wearable device APIs. The Health Data App uses the Wearipedia API to connect with devices like Fitbit, Garmin, Whoop, and others.

## How the Integration Works

The integration follows these steps:

1. User selects a device to connect from the Wearables page
2. App initiates OAuth flow with the device manufacturer (or generates test data)
3. Upon successful connection, the device appears in the user's connected devices list
4. User can sync data from the device, which is then:
   - Converted to Open mHealth format
   - Transformed to FHIR resources 
   - Stored in the user's health record

## Setup Requirements

### Dependencies

The app requires the following npm packages:
- `axios` for API requests
- `uuid` for generating unique IDs
- Firebase packages for storage

### Configuration

Create a `.env.local` file with your Firebase configuration:

```
# See .env.example for required variables
```

## Implementation Components

The integration consists of these components:

1. **Wearipedia Client** (`app/lib/wearipedia-client.ts`): TypeScript client that communicates with the Wearipedia API or generates test data.
   
2. **Wearable Service** (`app/lib/wearable-service.ts`): TypeScript service that provides functions for the frontend to interact with the wearable devices.

3. **Open mHealth Converter** (`app/lib/omh-converter.ts`): Converts raw wearable data to Open mHealth format.

4. **FHIR Converter** (`app/lib/wearable-fhir-converter.ts`): Converts Open mHealth data to FHIR resources for storage.

5. **Wearables UI** (`app/wearables/page.tsx`): React component that provides the UI for connecting and syncing devices.

## Using the Integration

### Connecting a Device

1. Navigate to the Wearables page
2. Click "Connect" on a device card
3. Either:
   - Enter your device API credentials and complete OAuth, or
   - Check "Use test data" to generate simulated data

### Syncing Data

1. Click "Sync" on a connected device
2. The app will fetch the latest data and process it
3. The synced data will be displayed and stored in the health record

## Test Data

For testing without real device credentials, the app can generate realistic test data for:
- Heart rate data (24 hours with 5-minute intervals)
- Step count (daily totals for the past week)
- Sleep data (past week with sleep stages)
- Activities (various types of physical activities)

Enable this by checking "Use test data" when connecting a device.

## Troubleshooting

Common issues:

- **OAuth errors**: Make sure your redirect URLs are properly configured in the device manufacturer's developer portal
- **Missing data**: Some data types may not be available from certain devices
- **API limits**: Device manufacturers may impose rate limits on their APIs 