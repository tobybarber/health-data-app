# Wearable Device Integration

This document explains how the wearable device integration works in the Health Data App.

## Overview

The wearable integration allows users to connect fitness devices and wearables like Fitbit, Garmin, Whoop, etc., sync their health data, and convert it to FHIR format for storage in their health record.

The integration is implemented completely in TypeScript/JavaScript and runs entirely in the browser, without requiring any server-side components or Python bridges.

## Architecture

The integration consists of several TypeScript modules:

1. **Wearipedia Client** (`app/lib/wearipedia-client.ts`): Provides direct communication with the Wearipedia API from the browser.

2. **Open mHealth Converter** (`app/lib/omh-converter.ts`): Converts raw wearable data to Open mHealth format, which is a standardized schema for health data.

3. **FHIR Converter** (`app/lib/wearable-fhir-converter.ts`): Converts Open mHealth data to FHIR resources (Observations, DiagnosticReports).

4. **Wearable Service** (`app/lib/wearable-service.ts`): Orchestrates the entire process of connecting devices, syncing data, and storing FHIR resources.

## Data Flow

The data flow for wearable integration follows these steps:

1. User connects a wearable device using OAuth or by selecting "Use Test Data"
2. Device connection credentials are stored in Firebase Firestore
3. When syncing data:
   - Raw data is retrieved from Wearipedia API (or generated if using test data)
   - Raw data is processed through the converter pipeline:
     - Raw Data → Open mHealth Format → FHIR Resources
   - FHIR resources are stored in Firestore under the patient's collection

## Setting Up

To use the wearable integration:

1. **Firebase Setup**:
   - Create a Firebase project with Firestore
   - Copy the `.env.example` file to `.env.local` and add your Firebase credentials
   - The app will use Firebase for storing device connections and FHIR resources

2. **Wearable Device Setup**:
   - For real devices like Fitbit, you need to register an app with the device manufacturer
   - Add the OAuth callback URL to your device app registration
   - For testing, you can use the "Use Test Data" option which doesn't require real credentials

## Implementation Details

### Connecting Devices

When connecting a device:
- For real devices, the app initiates OAuth flow with the device manufacturer
- After successful OAuth, device credentials are stored in Firestore
- For test data, mock credentials are created and stored

### Syncing Data

When syncing data:
- Credentials are retrieved from Firestore
- Data is pulled from Wearipedia API (or generated for test data)
- Data is processed through the converter pipeline
- FHIR resources are created and stored in Firestore

### Data Conversion

The data conversion follows Open mHealth standards:

1. Raw wearable data is converted to Open mHealth format
2. Open mHealth data is converted to FHIR resources
3. Statistical processing is applied for high-frequency data

## Test Data

The app can generate realistic test data for:
- Heart rate (24 hours, 5-minute intervals)
- Step count (7 days)
- Sleep (7 days, with deep/REM/light sleep stages)
- Activities (10 random activities of different types)

This allows testing the app without connecting real devices.

## Adding New Device Types

To add support for a new device type:
1. Add it to the `WearableDevice` type in `wearable-service.ts`
2. Add device metadata to the `AVAILABLE_DEVICES` array in `wearables/page.tsx`
3. Add data category mapping in `deviceDataCategories` in `wearable-service.ts`

## FHIR Resources

The app creates these FHIR resources from wearable data:
- **Observation**: Individual measurements (heart rate, steps, etc.)
- **DiagnosticReport**: Summary reports for each data category

Each resource follows FHIR R4 standards with appropriate coding systems. 