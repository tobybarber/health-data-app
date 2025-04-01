# Health App Data Model

## Overview

This document outlines the data model for the Health App, with a focus on how wearable device data is stored, processed, and utilized throughout the application.

## Simplified Collection Structure

We've implemented a simplified approach to storing health data with a single unified collection structure, eliminating the previously problematic dual user/patient ID model.

### Collection Hierarchy

```
/users/{userId}/
  └── fhir_resources/
      ├── Observation_{id}
      ├── DiagnosticReport_{id}
      ├── Condition_{id}
      └── ... other FHIR resources
  └── devices/
      ├── fitbit_versa
      ├── whoop_whoop_4
      └── ... other connected devices
  └── records/
      └── ... uploaded medical records
```

## Key Design Principles

1. **Single Source of Truth**: All FHIR resources are stored exclusively in the `users/{userId}/fhir_resources` collection.

2. **Consistent Document IDs**: Document IDs follow the format `{ResourceType}_{resourceId}` for clarity and to prevent collisions.

3. **Direct User Association**: All health data is directly associated with the user ID, eliminating the need for separate patient IDs or cross-referencing between collections.

4. **FHIR Compliance**: While our storage model is simplified, the data structures themselves remain compliant with FHIR standards.

## Wearable Data Flow

The process of integrating wearable data follows these steps:

1. **Connection**: User connects a wearable device through the UI, which stores device credentials in `users/{userId}/devices/{deviceId}`.

2. **Sync**: When syncing data, the app:
   - Fetches data from the device/Wearipedia API
   - Processes raw data to FHIR format using `wearable-fhir-converter.ts`
   - Stores resulting Observations and DiagnosticReports in `users/{userId}/fhir_resources`

3. **Retrieval**: The `getResourcesByType()` function in `rag-service.ts` retrieves resources from the `fhir_resources` collection (with fallback to legacy `fhir` collection for backward compatibility).

4. **Analysis**: Holistic analysis combines all resources using LlamaIndex and OpenAI.

5. **Chat Context**: The question API retrieves resources from the same `fhir_resources` collection to provide context for chat responses.

## Benefits of This Approach

- **Simplicity**: A single collection hierarchy is easier to understand, maintain, and query
- **Reduced Redundancy**: No need to duplicate data across multiple collections
- **Consistent Access Patterns**: All components use the same approach to access health data
- **Future Extensibility**: Easier to add new resource types or data sources
- **Improved Performance**: More efficient queries without needing to check multiple collections

## Implementation Details

### Key Components

- `wearable-service.ts`: Handles device connections and data syncing, storing FHIR resources directly in the user's collection
- `wearable-fhir-converter.ts`: Transforms raw device data into FHIR-compliant Observations and DiagnosticReports
- `rag-service.ts`: Retrieves FHIR resources for retrieval-augmented generation
- `question/route.ts`: Uses the FHIR resources for chat context

### ID Management

We've removed the `getUserPatientId()` function and all references to separate patient IDs, using the user ID directly throughout the application for a more consistent experience.

## Migration

If you have existing data in the previous dual-collection structure, you can run the migration script to consolidate the data:

```bash
npm run migrate-fhir
```

The script moves data from `patients/{patientId}/{resourceType}` to `users/{userId}/fhir_resources` while maintaining all the original data integrity. 