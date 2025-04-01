/**
 * Open mHealth Converter - Converts wearable data to Open mHealth format
 *
 * This module provides utilities to convert data from wearables 
 * into Open mHealth compliant JSON schemas.
 */

import { v4 as uuidv4 } from 'uuid';

type TimestampValue = {
  value: string;
};

type SchemaId = {
  namespace: string;
  name: string;
  version: string;
};

type AcquisitionProvenance = {
  source_name: string;
  source_creation_date_time: TimestampValue;
  modality: string;
};

type Header = {
  id: string;
  creation_date_time: TimestampValue;
  schema_id: SchemaId;
  acquisition_provenance: AcquisitionProvenance;
};

type TimeInterval = {
  start_date_time: TimestampValue;
  end_date_time: TimestampValue;
};

type TimeFrame = {
  time_interval: TimeInterval;
};

type UnitValue = {
  value: number;
  unit: string;
};

type HeartRateBody = {
  effective_time_frame: TimeFrame;
  heart_rate: UnitValue;
};

type StepCountBody = {
  effective_time_frame: TimeFrame;
  step_count: number;
};

type SleepDurationBody = {
  effective_time_frame: TimeFrame;
  sleep_duration: UnitValue;
};

type SleepEpisodeBody = {
  effective_time_frame: TimeFrame;
  sleep_episode: {
    duration: UnitValue;
    deep_sleep_duration: UnitValue;
    light_sleep_duration: UnitValue;
    rem_sleep_duration: UnitValue;
  };
};

type PhysicalActivityBody = {
  effective_time_frame: TimeFrame;
  activity_name: string;
  distance?: UnitValue;
  reported_activity_intensity: string;
  kcal_burned?: UnitValue;
};

type DataPoint<T> = {
  header: Header;
  body: T;
};

type DataEntry = Record<string, any>;
type ConvertedData = Record<string, DataPoint<any>[]>;

export class OpenMHealthConverter {
  private schemaNamespace: string;

  constructor() {
    this.schemaNamespace = "omh";
  }

  /**
   * Create a standard Open mHealth header
   */
  createHeader(schemaId: string, schemaVersion: string, acquisitionSource: string = "Wearipedia"): Header {
    return {
      id: uuidv4(),
      creation_date_time: {
        value: new Date().toISOString()
      },
      schema_id: {
        namespace: this.schemaNamespace,
        name: schemaId,
        version: schemaVersion
      },
      acquisition_provenance: {
        source_name: acquisitionSource,
        source_creation_date_time: {
          value: new Date().toISOString()
        },
        modality: "sensed"
      }
    };
  }

  /**
   * Create a time frame for a single point in time
   */
  createTimeFrame(timestamp: string): TimeFrame {
    return {
      time_interval: {
        start_date_time: {
          value: timestamp
        },
        end_date_time: {
          value: timestamp
        }
      }
    };
  }

  /**
   * Create a time frame for an interval
   */
  createTimeInterval(startTime: string, endTime: string): TimeFrame {
    return {
      time_interval: {
        start_date_time: {
          value: startTime
        },
        end_date_time: {
          value: endTime
        }
      }
    };
  }

  /**
   * Convert heart rate data to Open mHealth heart-rate schema
   */
  convertHeartRate(heartRateData: DataEntry[]): DataPoint<HeartRateBody>[] {
    const result: DataPoint<HeartRateBody>[] = [];

    for (const entry of heartRateData) {
      try {
        const timestamp = entry.timestamp || entry.dateTime;
        const value = entry.value;

        if (!timestamp || value === undefined || value === null) {
          console.warn(`Skipping invalid heart rate entry:`, entry);
          continue;
        }

        const heartRateDP: DataPoint<HeartRateBody> = {
          header: this.createHeader("heart-rate", "2.0"),
          body: {
            effective_time_frame: this.createTimeFrame(timestamp),
            heart_rate: {
              value: value,
              unit: "beats/min"
            }
          }
        };

        result.push(heartRateDP);
      } catch (e) {
        console.error(`Error converting heart rate entry ${JSON.stringify(entry)}:`, e);
      }
    }

    return result;
  }

  /**
   * Convert step count data to Open mHealth step-count schema
   */
  convertStepCount(stepData: DataEntry[]): DataPoint<StepCountBody>[] {
    const result: DataPoint<StepCountBody>[] = [];

    for (const entry of stepData) {
      try {
        const timestamp = entry.timestamp || entry.date || entry.dateTime;
        const value = entry.value || entry.steps;

        if (!timestamp || value === undefined || value === null) {
          console.warn(`Skipping invalid step count entry:`, entry);
          continue;
        }

        const stepCountDP: DataPoint<StepCountBody> = {
          header: this.createHeader("step-count", "2.0"),
          body: {
            effective_time_frame: this.createTimeFrame(timestamp),
            step_count: value
          }
        };

        result.push(stepCountDP);
      } catch (e) {
        console.error(`Error converting step count entry ${JSON.stringify(entry)}:`, e);
      }
    }

    return result;
  }

  /**
   * Convert sleep data to Open mHealth sleep-duration and sleep-episode schemas
   */
  convertSleep(sleepData: DataEntry[]): DataPoint<SleepDurationBody | SleepEpisodeBody>[] {
    const result: DataPoint<SleepDurationBody | SleepEpisodeBody>[] = [];

    for (const entry of sleepData) {
      try {
        const timestamp = entry.timestamp || entry.dateTime;
        const duration = entry.duration;

        if (!timestamp || duration === undefined || duration === null) {
          console.warn(`Skipping invalid sleep entry:`, entry);
          continue;
        }

        // Create sleep duration data point
        const sleepDurationDP: DataPoint<SleepDurationBody> = {
          header: this.createHeader("sleep-duration", "1.0"),
          body: {
            effective_time_frame: this.createTimeFrame(timestamp),
            sleep_duration: {
              value: duration,
              unit: "min"
            }
          }
        };

        result.push(sleepDurationDP);

        // If we have detailed sleep data, create a sleep episode
        if ("deep" in entry && "light" in entry && "rem" in entry) {
          const sleepEpisodeDP: DataPoint<SleepEpisodeBody> = {
            header: this.createHeader("sleep-episode", "1.0"),
            body: {
              effective_time_frame: this.createTimeFrame(timestamp),
              sleep_episode: {
                duration: {
                  value: duration,
                  unit: "min"
                },
                deep_sleep_duration: {
                  value: entry.deep,
                  unit: "min"
                },
                light_sleep_duration: {
                  value: entry.light,
                  unit: "min"
                },
                rem_sleep_duration: {
                  value: entry.rem,
                  unit: "min"
                }
              }
            }
          };

          result.push(sleepEpisodeDP);
        }
      } catch (e) {
        console.error(`Error converting sleep entry ${JSON.stringify(entry)}:`, e);
      }
    }

    return result;
  }

  /**
   * Convert activity data to Open mHealth physical-activity schema
   */
  convertPhysicalActivity(activityData: DataEntry[]): DataPoint<PhysicalActivityBody>[] {
    const result: DataPoint<PhysicalActivityBody>[] = [];

    for (const entry of activityData) {
      try {
        const date = entry.date || entry.timestamp || entry.dateTime;
        const steps = entry.steps;
        const distance = entry.distance;
        const calories = entry.calories;

        if (!date) {
          console.warn(`Skipping invalid activity entry:`, entry);
          continue;
        }

        // Create physical activity data point
        const activityDP: DataPoint<PhysicalActivityBody> = {
          header: this.createHeader("physical-activity", "2.0"),
          body: {
            effective_time_frame: this.createTimeFrame(date),
            activity_name: "walking",
            reported_activity_intensity: "moderate",
            ...(distance !== undefined && distance !== null ? {
              distance: {
                value: distance,
                unit: "km"
              }
            } : {}),
            ...(calories !== undefined && calories !== null ? {
              kcal_burned: {
                value: calories,
                unit: "kcal"
              }
            } : {})
          }
        };

        result.push(activityDP);
      } catch (e) {
        console.error(`Error converting activity entry ${JSON.stringify(entry)}:`, e);
      }
    }

    return result;
  }

  /**
   * Create generic data points for unsupported categories
   */
  createGenericDataPoints(rawData: DataEntry[]): DataPoint<any>[] {
    return rawData.map(entry => ({
      header: this.createHeader("generic-data", "1.0"),
      body: {
        effective_time_frame: this.createTimeFrame(entry.timestamp || entry.date || entry.dateTime || new Date().toISOString()),
        data: entry
      }
    }));
  }

  /**
   * Convert data from different categories to Open mHealth format
   */
  convertData(data: Record<string, DataEntry[]>, deviceId: string): ConvertedData {
    const result: ConvertedData = {};

    for (const [category, categoryData] of Object.entries(data)) {
      if (!categoryData || categoryData.length === 0) {
        continue;
      }

      if (["heart_rate", "heart_rates", "hr"].includes(category)) {
        result[category] = this.convertHeartRate(categoryData);
      } else if (["steps", "step_count"].includes(category)) {
        result[category] = this.convertStepCount(categoryData);
      } else if (["sleep", "sleeps", "cycles"].includes(category)) {
        result[category] = this.convertSleep(categoryData);
      } else if (["activities", "activity"].includes(category)) {
        result[category] = this.convertPhysicalActivity(categoryData);
      } else {
        console.warn(`Unsupported data category: ${category}`);
        result[category] = this.createGenericDataPoints(categoryData);
      }
    }

    return result;
  }
} 