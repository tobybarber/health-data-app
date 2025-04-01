'use client';

import { Observation } from '../types/fhir';

// Constants for FHIR observation codes
const LOINC_SYSTEM = 'http://loinc.org';
const UNITS_SYSTEM = 'http://unitsofmeasure.org';

// LOINC codes for common wearable metrics
const LOINC_CODES = {
  // Vital signs
  HEART_RATE: '8867-4',
  RESPIRATORY_RATE: '9279-1',
  BLOOD_PRESSURE_SYSTOLIC: '8480-6',
  BLOOD_PRESSURE_DIASTOLIC: '8462-4',
  BODY_TEMPERATURE: '8310-5',
  OXYGEN_SATURATION: '59408-5',
  
  // Activity
  STEPS: '41950-7',
  DISTANCE: '85530-4',
  CALORIES: '41979-6',
  ACTIVE_MINUTES: '41982-0',
  
  // Sleep
  SLEEP_DURATION: '93832-4',
  
  // Glucose
  GLUCOSE_LEVEL: '2339-0'
};

/**
 * Create a FHIR Observation for heart rate data
 */
export function createHeartRateObservation(
  timestamp: string | Date,
  value: number,
  deviceName: string,
  patientId: string
): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: LOINC_CODES.HEART_RATE,
        display: 'Heart rate'
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: typeof timestamp === 'string' ? timestamp : timestamp.toISOString(),
    valueQuantity: {
      value: value,
      unit: 'beats/minute',
      system: UNITS_SYSTEM,
      code: '/min'
    },
    device: {
      display: deviceName
    }
  };
}

/**
 * Create a FHIR Observation for step count data
 */
export function createStepsObservation(
  timestamp: string | Date,
  value: number,
  deviceName: string,
  patientId: string
): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'activity',
        display: 'Activity'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: LOINC_CODES.STEPS,
        display: 'Steps'
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: typeof timestamp === 'string' ? timestamp : timestamp.toISOString(),
    valueQuantity: {
      value: value,
      unit: 'steps',
      system: UNITS_SYSTEM,
      code: 'steps'
    },
    device: {
      display: deviceName
    }
  };
}

/**
 * Create a FHIR Observation for sleep data
 */
export function createSleepObservation(
  timestamp: string | Date,
  durationMinutes: number,
  deviceName: string,
  patientId: string
): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'sleep',
        display: 'Sleep'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: LOINC_CODES.SLEEP_DURATION,
        display: 'Sleep duration'
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: typeof timestamp === 'string' ? timestamp : timestamp.toISOString(),
    valueQuantity: {
      value: durationMinutes,
      unit: 'min',
      system: UNITS_SYSTEM,
      code: 'min'
    },
    device: {
      display: deviceName
    }
  };
}

/**
 * Create a FHIR Observation for glucose level data
 */
export function createGlucoseObservation(
  timestamp: string | Date,
  value: number,
  deviceName: string,
  patientId: string
): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory'
      }]
    }],
    code: {
      coding: [{
        system: LOINC_SYSTEM,
        code: LOINC_CODES.GLUCOSE_LEVEL,
        display: 'Glucose [Mass/volume] in Blood'
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: typeof timestamp === 'string' ? timestamp : timestamp.toISOString(),
    valueQuantity: {
      value: value,
      unit: 'mg/dL',
      system: UNITS_SYSTEM,
      code: 'mg/dL'
    },
    device: {
      display: deviceName
    }
  };
}

/**
 * Map wearable data to FHIR resources based on device type and data category
 */
export function mapWearableDataToFHIR(
  deviceId: string,
  deviceName: string,
  dataCategory: string,
  data: any[],
  patientId: string
): Observation[] {
  const observations: Observation[] = [];
  
  // Different devices have different data structures
  // This is a simple implementation - a real one would be more comprehensive
  
  switch(dataCategory) {
    case 'hr':
    case 'heart_rate':
    case 'heart_rates':
      // Heart rate data - typically an array of values with timestamps
      data.forEach(item => {
        // Adapt to different data structures based on device
        const timestamp = item.timestamp || item.date || item.time;
        const value = item.value || item.hr || item.heart_rate;
        
        if (timestamp && value) {
          observations.push(
            createHeartRateObservation(timestamp, value, deviceName, patientId)
          );
        }
      });
      break;
      
    case 'steps':
      // Step count data
      data.forEach(item => {
        const timestamp = item.timestamp || item.date || item.time;
        const value = item.value || item.steps || item.count;
        
        if (timestamp && value) {
          observations.push(
            createStepsObservation(timestamp, value, deviceName, patientId)
          );
        }
      });
      break;
      
    case 'sleep':
    case 'sleeps':
    case 'cycles':
      // Sleep data
      data.forEach(item => {
        const timestamp = item.timestamp || item.date || item.time;
        const duration = item.duration || item.sleep_duration || item.minutes;
        
        if (timestamp && duration) {
          observations.push(
            createSleepObservation(timestamp, duration, deviceName, patientId)
          );
        }
      });
      break;
      
    case 'dataframe':
      // For Dexcom and other glucose monitors
      data.forEach(item => {
        const timestamp = item.timestamp || item.date || item.time;
        const value = item.value || item.glucose || item.glucose_value;
        
        if (timestamp && value) {
          observations.push(
            createGlucoseObservation(timestamp, value, deviceName, patientId)
          );
        }
      });
      break;
      
    default:
      console.warn(`Unsupported data category: ${dataCategory}`);
  }
  
  return observations;
} 