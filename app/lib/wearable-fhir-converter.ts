/**
 * Wearable FHIR Converter - Transforms wearable data into FHIR resources
 *
 * This module leverages the Open mHealth converter and transforms the data
 * into appropriate FHIR resources for storage in the health record.
 */

import { v4 as uuidv4 } from 'uuid';
import { OpenMHealthConverter } from './omh-converter';
import { DeviceData, DeviceCredentials } from './wearipedia-client';
import { Observation, DiagnosticReport } from '../types/fhir';

// Interface for the processed and transformed data
export interface ProcessedWearableData {
  observations: Observation[];
  reports: DiagnosticReport[];
  summary: {
    heartRate?: {
      min: number;
      max: number;
      avg: number;
      count: number;
    };
    steps?: {
      total: number;
      avg: number;
      days: number;
    };
    sleep?: {
      avgDuration: number;
      avgDeep: number;
      avgRem: number;
      avgLight: number;
      days: number;
    };
    activities?: {
      count: number;
      types: string[];
      totalDuration: number;
      totalCalories: number;
    };
  };
  rawData?: DeviceData;
}

export class WearableFhirConverter {
  private omhConverter: OpenMHealthConverter;
  
  constructor() {
    this.omhConverter = new OpenMHealthConverter();
  }

  /**
   * Process data from a wearable device and convert it to FHIR resources
   */
  async processWearableData(
    data: DeviceData,
    deviceInfo: DeviceCredentials,
    userId: string
  ): Promise<ProcessedWearableData> {
    // First, convert raw data to Open mHealth format
    const omhData = this.omhConverter.convertData(data, deviceInfo.deviceId);
    
    // Initialize result object
    const result: ProcessedWearableData = {
      observations: [],
      reports: [],
      summary: {}
    };

    // Process heart rate data
    if (data.heart_rate && data.heart_rate.length > 0) {
      const heartRateObservations = this.createHeartRateObservations(data.heart_rate, userId);
      result.observations.push(...heartRateObservations);
      
      // Calculate heart rate summary
      const heartRates = data.heart_rate.map(hr => Number(hr.value)).filter(hr => !isNaN(hr));
      if (heartRates.length > 0) {
        result.summary.heartRate = {
          min: Math.min(...heartRates),
          max: Math.max(...heartRates),
          avg: Math.round(heartRates.reduce((sum, val) => sum + val, 0) / heartRates.length),
          count: heartRates.length
        };
      }
      
      // Create a diagnostic report for heart rate data
      const reportId = uuidv4();
      const heartRateReport = this.createDiagnosticReport(
        'heart-rate-summary',
        'Heart Rate Summary',
        userId,
        heartRateObservations.map(obs => obs.id as string),
        reportId
      );
      result.reports.push(heartRateReport);
    }
    
    // Process step data
    if (data.steps && data.steps.length > 0) {
      const stepObservations = this.createStepCountObservations(data.steps, userId);
      result.observations.push(...stepObservations);
      
      // Calculate step count summary
      const totalSteps = data.steps.reduce((sum, day) => sum + Number(day.steps || day.value), 0);
      result.summary.steps = {
        total: totalSteps,
        avg: Math.round(totalSteps / data.steps.length),
        days: data.steps.length
      };
      
      // Create a diagnostic report for step data
      const reportId = uuidv4();
      const stepReport = this.createDiagnosticReport(
        'step-count-summary',
        'Step Count Summary',
        userId,
        stepObservations.map(obs => obs.id as string),
        reportId
      );
      result.reports.push(stepReport);
    }
    
    // Process sleep data
    if (data.sleep && data.sleep.length > 0) {
      const sleepObservations = this.createSleepObservations(data.sleep, userId);
      result.observations.push(...sleepObservations);
      
      // Calculate sleep summary
      let totalDuration = 0;
      let totalDeep = 0;
      let totalRem = 0;
      let totalLight = 0;
      let daysWithSleep = 0;
      
      data.sleep.forEach(sleep => {
        if (sleep.duration) {
          totalDuration += Number(sleep.duration);
          daysWithSleep++;
          
          if (sleep.deep) totalDeep += Number(sleep.deep);
          if (sleep.rem) totalRem += Number(sleep.rem);
          if (sleep.light) totalLight += Number(sleep.light);
        }
      });
      
      if (daysWithSleep > 0) {
        result.summary.sleep = {
          avgDuration: Math.round(totalDuration / daysWithSleep),
          avgDeep: Math.round(totalDeep / daysWithSleep),
          avgRem: Math.round(totalRem / daysWithSleep),
          avgLight: Math.round(totalLight / daysWithSleep),
          days: daysWithSleep
        };
      }
      
      // Create a diagnostic report for sleep data
      const reportId = uuidv4();
      const sleepReport = this.createDiagnosticReport(
        'sleep-summary',
        'Sleep Summary',
        userId,
        sleepObservations.map(obs => obs.id as string),
        reportId
      );
      result.reports.push(sleepReport);
    }
    
    // Process activities data
    if (data.activities && data.activities.length > 0) {
      const activityObservations = this.createActivityObservations(data.activities, userId);
      result.observations.push(...activityObservations);
      
      // Calculate activity summary
      const activityTypes = new Set<string>();
      let totalDuration = 0;
      let totalCalories = 0;
      
      data.activities.forEach(activity => {
        if (activity.type) activityTypes.add(activity.type);
        if (activity.duration) totalDuration += Number(activity.duration);
        if (activity.calories) totalCalories += Number(activity.calories);
      });
      
      result.summary.activities = {
        count: data.activities.length,
        types: Array.from(activityTypes),
        totalDuration,
        totalCalories
      };
      
      // Create a diagnostic report for activity data
      const reportId = uuidv4();
      const activityReport = this.createDiagnosticReport(
        'activity-summary',
        'Physical Activity Summary',
        userId,
        activityObservations.map(obs => obs.id as string),
        reportId
      );
      result.reports.push(activityReport);
    }
    
    // Include raw data if needed
    result.rawData = data;
    
    return result;
  }

  /**
   * Create FHIR Observations for heart rate data
   */
  private createHeartRateObservations(heartRateData: any[], userId: string): Observation[] {
    return heartRateData.map(hr => {
      const id = uuidv4();
      const timestamp = hr.dateTime || hr.timestamp || hr.date || new Date().toISOString();
      
      return {
        resourceType: 'Observation',
        id,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ],
            text: 'Vital Signs'
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8867-4',
              display: 'Heart rate'
            }
          ],
          text: 'Heart rate'
        },
        subject: {
          reference: `Patient/${userId}`
        },
        effectiveDateTime: timestamp,
        valueQuantity: {
          value: Number(hr.value),
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      };
    });
  }

  /**
   * Create FHIR Observations for step count data
   */
  private createStepCountObservations(stepData: any[], userId: string): Observation[] {
    return stepData.map(step => {
      const id = uuidv4();
      const timestamp = step.dateTime || step.timestamp || step.date || new Date().toISOString();
      
      return {
        resourceType: 'Observation',
        id,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'activity',
                display: 'Activity'
              }
            ],
            text: 'Activity'
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '41950-7',
              display: 'Number of steps in 24 hour Measured'
            }
          ],
          text: 'Steps'
        },
        subject: {
          reference: `Patient/${userId}`
        },
        effectiveDateTime: timestamp,
        valueQuantity: {
          value: Number(step.value || step.steps),
          unit: 'steps',
          system: 'http://unitsofmeasure.org',
          code: 'steps'
        }
      };
    });
  }

  /**
   * Create FHIR Observations for sleep data
   */
  private createSleepObservations(sleepData: any[], userId: string): Observation[] {
    const observations: Observation[] = [];
    
    sleepData.forEach(sleep => {
      const timestamp = sleep.dateTime || sleep.timestamp || sleep.date;
      if (!timestamp) return;
      
      // Total sleep duration
      if (sleep.duration) {
        const id = uuidv4();
        observations.push({
          resourceType: 'Observation',
          id,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ],
              text: 'Vital Signs'
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '93832-4',
                display: 'Sleep duration'
              }
            ],
            text: 'Sleep duration'
          },
          subject: {
            reference: `Patient/${userId}`
          },
          effectiveDateTime: timestamp,
          valueQuantity: {
            value: Number(sleep.duration),
            unit: 'min',
            system: 'http://unitsofmeasure.org',
            code: 'min'
          }
        });
      }
      
      // Deep sleep
      if (sleep.deep) {
        const id = uuidv4();
        observations.push({
          resourceType: 'Observation',
          id,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ],
              text: 'Vital Signs'
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '93831-6',
                display: 'Deep sleep duration'
              }
            ],
            text: 'Deep sleep duration'
          },
          subject: {
            reference: `Patient/${userId}`
          },
          effectiveDateTime: timestamp,
          valueQuantity: {
            value: Number(sleep.deep),
            unit: 'min',
            system: 'http://unitsofmeasure.org',
            code: 'min'
          }
        });
      }
      
      // REM sleep
      if (sleep.rem) {
        const id = uuidv4();
        observations.push({
          resourceType: 'Observation',
          id,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ],
              text: 'Vital Signs'
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '93830-8',
                display: 'REM sleep duration'
              }
            ],
            text: 'REM sleep duration'
          },
          subject: {
            reference: `Patient/${userId}`
          },
          effectiveDateTime: timestamp,
          valueQuantity: {
            value: Number(sleep.rem),
            unit: 'min',
            system: 'http://unitsofmeasure.org',
            code: 'min'
          }
        });
      }
      
      // Light sleep
      if (sleep.light) {
        const id = uuidv4();
        observations.push({
          resourceType: 'Observation',
          id,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ],
              text: 'Vital Signs'
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '93829-0',
                display: 'Light sleep duration'
              }
            ],
            text: 'Light sleep duration'
          },
          subject: {
            reference: `Patient/${userId}`
          },
          effectiveDateTime: timestamp,
          valueQuantity: {
            value: Number(sleep.light),
            unit: 'min',
            system: 'http://unitsofmeasure.org',
            code: 'min'
          }
        });
      }
    });
    
    return observations;
  }

  /**
   * Create FHIR Observations for physical activity data
   */
  private createActivityObservations(activityData: any[], userId: string): Observation[] {
    const observations: Observation[] = [];
    
    activityData.forEach(activity => {
      const timestamp = activity.dateTime || activity.timestamp || activity.date;
      if (!timestamp) return;
      
      const type = activity.type || 'walking';
      
      // Create activity observation
      const id = uuidv4();
      observations.push({
        resourceType: 'Observation',
        id,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'activity',
                display: 'Activity'
              }
            ],
            text: 'Activity'
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '41981-2',
              display: 'Exercise activity'
            }
          ],
          text: `${type.charAt(0).toUpperCase() + type.slice(1)} activity`
        },
        subject: {
          reference: `Patient/${userId}`
        },
        effectiveDateTime: timestamp,
        component: [
          // Duration
          ...(activity.duration ? [{
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '93832-4',
                  display: 'Duration'
                }
              ],
              text: 'Duration'
            },
            valueQuantity: {
              value: Number(activity.duration),
              unit: 'min',
              system: 'http://unitsofmeasure.org',
              code: 'min'
            }
          }] : []),
          
          // Distance
          ...(activity.distance ? [{
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '41979-6',
                  display: 'Distance walked'
                }
              ],
              text: 'Distance'
            },
            valueQuantity: {
              value: Number(activity.distance),
              unit: 'km',
              system: 'http://unitsofmeasure.org',
              code: 'km'
            }
          }] : []),
          
          // Calories
          ...(activity.calories ? [{
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '41981-2',
                  display: 'Calories burned'
                }
              ],
              text: 'Calories'
            },
            valueQuantity: {
              value: Number(activity.calories),
              unit: 'kcal',
              system: 'http://unitsofmeasure.org',
              code: 'kcal'
            }
          }] : []),
          
          // Heart rate
          ...(activity.avg_heart_rate ? [{
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8867-4',
                  display: 'Heart rate'
                }
              ],
              text: 'Average heart rate'
            },
            valueQuantity: {
              value: Number(activity.avg_heart_rate),
              unit: 'beats/min',
              system: 'http://unitsofmeasure.org',
              code: '/min'
            }
          }] : [])
        ]
      });
    });
    
    return observations;
  }

  /**
   * Create a DiagnosticReport for a set of observations
   */
  private createDiagnosticReport(
    code: string,
    displayName: string,
    userId: string,
    observationIds: string[],
    id?: string
  ): DiagnosticReport {
    return {
      resourceType: 'DiagnosticReport',
      id: id || uuidv4(),
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code,
            display: displayName
          }
        ],
        text: displayName
      },
      subject: {
        reference: `Patient/${userId}`
      },
      effectiveDateTime: new Date().toISOString(),
      issued: new Date().toISOString(),
      result: observationIds.map(obsId => ({
        reference: `Observation/${obsId}`
      }))
    };
  }
} 