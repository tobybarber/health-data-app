# FHIR Implementation

This document describes the FHIR (Fast Healthcare Interoperability Resources) implementation in the Health Data App.

## Overview

The app now supports FHIR R4 standard for healthcare data interoperability. The implementation includes:

1. **Core FHIR Resources**: Patient, Observation, DiagnosticReport, Medication, MedicationStatement, Condition, AllergyIntolerance, and Immunization
2. **RESTful API**: Implementation of standard FHIR RESTful operations
3. **Terminologies**: Standard codes like LOINC for lab tests, RxNorm for medications, ICD-10 for conditions, and CVX for immunizations
4. **Data Visualization**: FHIR-compliant visualization of observations over time
5. **Structured Data Extraction**: Automatic extraction of structured data from uploaded documents

## File Structure

The FHIR implementation consists of the following files:

- `app/types/fhir.ts` - TypeScript interfaces for FHIR resources
- `app/lib/fhir-service.ts` - Utilities for working with FHIR resources in Firebase
- `app/lib/fhir-converter.ts` - Conversion utilities between app data and FHIR format
- `app/lib/analysis-utils.ts` - Utilities for extracting structured data from analysis results
- `app/api/fhir/[resourceType]/route.ts` - REST API for FHIR resources
- `app/api/fhir/[resourceType]/[id]/route.ts` - REST API for specific resources by ID
- `app/api/openai/analyze/route.ts` - Integration with OpenAI for document analysis and FHIR resource creation
- `app/components/FHIRObservationChart.tsx` - Component for visualizing FHIR observations
- `app/fhir-demo/page.tsx` - Demo page showcasing FHIR capabilities

## Data Models

The app implements the following FHIR resources:

### Patient

Represents a patient in the healthcare system. Example:

```json
{
  "resourceType": "Patient",
  "id": "example-id",
  "name": [
    {
      "use": "official",
      "family": "Smith",
      "given": ["John"],
      "text": "John Smith"
    }
  ],
  "gender": "male",
  "birthDate": "1970-01-01"
}
```

### Observation

Represents a lab test or measurement. Example:

```json
{
  "resourceType": "Observation",
  "id": "example-id",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "2276-4",
        "display": "Ferritin [Mass/volume] in Serum or Plasma"
      }
    ],
    "text": "Ferritin"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "effectiveDateTime": "2023-01-15",
  "valueQuantity": {
    "value": 120,
    "unit": "ng/mL",
    "system": "http://unitsofmeasure.org",
    "code": "ng/mL"
  },
  "referenceRange": [
    {
      "low": {
        "value": 20,
        "unit": "ng/mL"
      },
      "high": {
        "value": 300,
        "unit": "ng/mL"
      }
    }
  ]
}
```

### DiagnosticReport

Represents a collection of observations or a medical report. Example:

```json
{
  "resourceType": "DiagnosticReport",
  "id": "example-id",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "11502-2",
        "display": "Laboratory Report"
      }
    ],
    "text": "Laboratory Report"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "effectiveDateTime": "2023-01-15",
  "issued": "2023-01-16T14:30:00Z",
  "result": [
    {
      "reference": "Observation/observation-id-1"
    },
    {
      "reference": "Observation/observation-id-2"
    }
  ],
  "conclusion": "Normal lab results",
  "presentedForm": [
    {
      "contentType": "application/pdf",
      "url": "https://example.com/report.pdf"
    }
  ]
}
```

### Medication

Represents a medication. Example:

```json
{
  "resourceType": "Medication",
  "id": "example-id",
  "code": {
    "coding": [
      {
        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code": "1191",
        "display": "Aspirin"
      }
    ],
    "text": "Aspirin"
  },
  "status": "active",
  "form": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm",
        "code": "tablet",
        "display": "Tablet"
      }
    ],
    "text": "Tablet"
  }
}
```

### MedicationStatement

Represents a statement about a medication being taken by a patient. Example:

```json
{
  "resourceType": "MedicationStatement",
  "id": "example-id",
  "status": "active",
  "medicationReference": {
    "reference": "Medication/medication-id"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "effectiveDateTime": "2023-01-15",
  "dateAsserted": "2023-01-16T14:30:00Z",
  "dosage": [
    {
      "text": "1 tablet once daily"
    }
  ]
}
```

### Condition

Represents a medical condition or diagnosis. Example:

```json
{
  "resourceType": "Condition",
  "id": "example-id",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active",
        "display": "Active"
      }
    ]
  },
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10",
        "code": "I10",
        "display": "Essential (primary) hypertension"
      }
    ],
    "text": "Hypertension"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "onsetDateTime": "2022-05-01",
  "recordedDate": "2023-01-15"
}
```

### AllergyIntolerance

Represents an allergy or intolerance. Example:

```json
{
  "resourceType": "AllergyIntolerance",
  "id": "example-id",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        "code": "active",
        "display": "Active"
      }
    ]
  },
  "type": "allergy",
  "category": ["medication"],
  "criticality": "high",
  "code": {
    "text": "Penicillin"
  },
  "patient": {
    "reference": "Patient/patient-id"
  },
  "recordedDate": "2023-01-15",
  "reaction": [
    {
      "manifestation": [
        {
          "text": "Hives"
        }
      ],
      "severity": "moderate"
    }
  ]
}
```

### Immunization

Represents a vaccination. Example:

```json
{
  "resourceType": "Immunization",
  "id": "example-id",
  "status": "completed",
  "vaccineCode": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/cvx",
        "code": "141",
        "display": "Influenza, seasonal, injectable, preservative free"
      }
    ],
    "text": "Flu Shot"
  },
  "patient": {
    "reference": "Patient/patient-id"
  },
  "occurrenceDateTime": "2023-01-15",
  "primarySource": true,
  "lotNumber": "AAJN11K",
  "site": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-ActSite",
        "code": "LA",
        "display": "Left Arm"
      }
    ],
    "text": "Left Arm"
  }
}
```

## REST API

The app implements the following RESTful endpoints:

- `GET /api/fhir/{resourceType}` - Search for resources
- `GET /api/fhir/{resourceType}?_id={id}` - Get a specific resource
- `POST /api/fhir/{resourceType}` - Create a new resource
- `PUT /api/fhir/{resourceType}` - Update a resource
- `DELETE /api/fhir/{resourceType}?_id={id}` - Delete a resource

Additionally, for direct resource access:

- `GET /api/fhir/{resourceType}/{id}` - Get a specific resource by ID
- `PUT /api/fhir/{resourceType}/{id}` - Update a specific resource by ID
- `DELETE /api/fhir/{resourceType}/{id}` - Delete a specific resource by ID

## Automatic Resource Creation from Documents

The app now supports automatic creation of FHIR resources from uploaded documents:

1. **Document Upload**: Users upload health records (PDF, images)
2. **OpenAI Analysis**: Documents are analyzed using OpenAI to extract structured data
3. **Record Type Detection**: The system identifies the document type (e.g., lab report, medication list)
4. **FHIR Resource Creation**: Appropriate FHIR resources are automatically created:
   - Laboratory Reports -> Observations + DiagnosticReport
   - Medication Lists -> Medications + MedicationStatements
   - Immunization Records -> Immunizations
   - Allergy Lists -> AllergyIntolerances
   - Problem Lists -> Conditions

This feature significantly reduces manual data entry and ensures comprehensive health record capture.

## Firebase Storage Structure

FHIR resources are stored in Firebase Firestore using the following path pattern:

```
/users/{userId}/fhir_resources/{resourceTypeAndId}
```

Where `resourceTypeAndId` is a concatenation of the resource type and ID, separated by an underscore, such as `Patient_123`. This ensures proper alternation between collections and documents in Firestore.

## Demo Page

A demo page is available at `/fhir-demo` to showcase the FHIR implementation. It allows you to:

1. Create a demo patient with sample lab results
2. View lab results as FHIR Observations
3. Visualize lab data trends over time
4. Explore the created FHIR resources

## Future Enhancements

Planned additions to the FHIR implementation include:

1. Support for more complex searches
2. SMART on FHIR authorization
3. FHIR bulk data operations
4. Support for FHIR versioning and history
5. Implementation of FHIR operations
6. Enhanced validation against FHIR profiles
7. Direct integration with external FHIR servers
8. Support for FHIR-based clinical decision support 