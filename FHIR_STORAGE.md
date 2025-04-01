# FHIR Resource Storage Model

## Overview

This document outlines how FHIR resources are stored in the Health App, explaining the unified storage model that consolidates data from multiple sources (document uploads, wearable devices, AI-generated resources) into a single standardized collection.

## Unified Collection Structure

All FHIR resources (regardless of source) are now stored in a single collection hierarchy:

```
/users/{userId}/fhir_resources/{ResourceType}_{resourceId}
```

Examples:
- `/users/abc123/fhir_resources/Observation_12345`
- `/users/abc123/fhir_resources/DiagnosticReport_report1`
- `/users/abc123/fhir_resources/Condition_hypertension`

## Key Design Principles

1. **Single Source of Truth**: All FHIR resources are stored in the `fhir_resources` collection, regardless of their origin.

2. **Consistent Document ID Format**: Document IDs always follow the format `{ResourceType}_{resourceId}` for clarity and to prevent collisions.

3. **Flat Collection Structure**: The collection is "flat" in that it contains all resource types, with the resource type encoded in both the document ID and the `resourceType` field of the document.

4. **Automatic Deduplication**: Resources with the same type and ID will overwrite each other, preventing duplicate data.

## Data Sources

The Health App processes FHIR resources from multiple sources:

### 1. Document Uploads
- PDFs, images, and other medical documents
- Processed through `records/upload/route.ts`
- Extracted FHIR resources stored in `fhir_resources`

### 2. Wearable Devices
- Data from fitness trackers, smartwatches, etc.
- Processed through `wearable-service.ts`
- Converted to FHIR Observations and DiagnosticReports
- Stored in `fhir_resources`

### 3. AI Analysis
- Resources extracted from AI analysis of uploaded documents
- Processed through `openai/analyze/route.ts`
- Stored in `fhir_resources`

## API Access

The Health App provides FHIR-compliant API endpoints for accessing resources:

- `GET /api/fhir/{resourceType}` - Search for resources
- `GET /api/fhir/{resourceType}/{id}` - Get a specific resource
- `POST /api/fhir/{resourceType}` - Create a new resource
- `PUT /api/fhir/{resourceType}/{id}` - Update a resource
- `DELETE /api/fhir/{resourceType}/{id}` - Delete a resource

All these endpoints now operate on the unified `fhir_resources` collection.

## Benefits

This unified approach provides several advantages:

1. **Simplified Querying**: All resources can be found in a single collection, making retrieval more straightforward.

2. **Efficient Semantic Search**: The RAG system can search across all FHIR resources regardless of source.

3. **Consistent User Experience**: The chat interface has access to all health data in one place.

4. **Future Extensibility**: New data sources can be easily added by simply writing to the same collection.

5. **Reduced Code Complexity**: Data access code is simpler with a single collection to query.

## Migration

If you have existing data in the legacy `fhir` collection, you can delete it and reupload your documents since we're at the prototype stage. The new unified storage model will ensure all new data is properly stored in the standardized format. 