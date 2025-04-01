'use client';

import { useState, useEffect } from 'react';
import HeartRateChart from './HeartRateChart';
import StepCountChart from './StepCountChart';
import SleepChart from './SleepChart';

interface WearableDataDashboardProps {
  syncedData: any;
}

interface HeartRateDataItem {
  dateTime?: string;
  timestamp?: string;
  date?: string;
  value: number;
}

interface StepDataItem {
  dateTime?: string;
  timestamp?: string;
  date?: string;
  value?: number;
  steps?: number;
}

interface SleepDataItem {
  dateTime?: string;
  timestamp?: string;
  date?: string;
  duration?: number;
  deep?: number;
  light?: number;
  rem?: number;
  awake?: number;
}

export default function WearableDataDashboard({ syncedData }: WearableDataDashboardProps) {
  const [hasHeartRateData, setHasHeartRateData] = useState(false);
  const [hasStepData, setHasStepData] = useState(false);
  const [hasSleepData, setHasSleepData] = useState(false);
  
  console.log('WearableDataDashboard rendered with syncedData:', syncedData);
  
  useEffect(() => {
    console.log('WearableDataDashboard useEffect triggered');
    if (syncedData) {
      // Debug the data structure
      console.log('Dashboard received synced data:', syncedData);
      console.log('Data keys:', Object.keys(syncedData));
      
      // Check for categories or direct data
      const hasCategories = syncedData.categories && typeof syncedData.categories === 'object';
      console.log('Has categories object:', hasCategories);
      
      // Determine where to look for data
      const dataSource = hasCategories ? syncedData.categories : syncedData;
      console.log('Using data source:', dataSource);
      
      // Check if we have data for each category
      const heartRateData = dataSource.heartrate || dataSource.heart_rate || [];
      const stepData = dataSource.steps || [];
      const sleepData = dataSource.sleep || [];
      
      console.log('Heart rate data:', heartRateData.length, 'items');
      console.log('Step data:', stepData.length, 'items');
      console.log('Sleep data:', sleepData.length, 'items');
      
      // Log sample of each data type if available
      if (heartRateData.length > 0) console.log('Sample heart rate data:', heartRateData[0]);
      if (stepData.length > 0) console.log('Sample step data:', stepData[0]);
      if (sleepData.length > 0) console.log('Sample sleep data:', sleepData[0]);
      
      // Validate data structure for each type
      const isValidHeartRateData = heartRateData.length > 0 && heartRateData.every((item: HeartRateDataItem) => 
        item && typeof item === 'object' && 
        (item.dateTime || item.timestamp || item.date) && 
        typeof item.value === 'number'
      );
      
      const isValidStepData = stepData.length > 0 && stepData.every((item: StepDataItem) =>
        item && typeof item === 'object' &&
        (item.dateTime || item.timestamp || item.date) &&
        (typeof item.value === 'number' || typeof item.steps === 'number')
      );
      
      const isValidSleepData = sleepData.length > 0 && sleepData.every((item: SleepDataItem) =>
        item && typeof item === 'object' &&
        (item.dateTime || item.timestamp || item.date)
      );
      
      console.log('Data validation:', {
        heartRate: isValidHeartRateData,
        steps: isValidStepData,
        sleep: isValidSleepData
      });
      
      setHasHeartRateData(isValidHeartRateData);
      setHasStepData(isValidStepData);
      setHasSleepData(isValidSleepData);
    } else {
      console.log('No synced data received by dashboard');
      setHasHeartRateData(false);
      setHasStepData(false);
      setHasSleepData(false);
    }
  }, [syncedData]);
  
  if (!syncedData) {
    console.log('Rendering no data available message');
    return (
      <div className="mt-8 p-4 bg-gray-800 rounded-lg text-center">
        <p className="text-gray-400">No data available. Sync your device to see charts.</p>
      </div>
    );
  }
  
  const hasAnyData = hasHeartRateData || hasStepData || hasSleepData;
  console.log('Has any data:', hasAnyData, { hasHeartRateData, hasStepData, hasSleepData });
  
  if (!hasAnyData) {
    console.log('Rendering no chart data available message');
    return (
      <div className="mt-8 p-4 bg-gray-800 rounded-lg text-center">
        <p className="text-gray-400">No chart data available from this device.</p>
      </div>
    );
  }
  
  // Determine data source (either direct or from categories)
  const dataSource = syncedData.categories && typeof syncedData.categories === 'object' 
    ? syncedData.categories 
    : syncedData;
  
  console.log('Rendering charts with data source:', dataSource);
  
  return (
    <div className="mt-8 space-y-8">
      <h2 className="text-xl font-semibold text-primary-blue">Data Visualization</h2>
      
      {hasHeartRateData && (
        <div className="p-4 bg-gray-900 rounded-lg shadow">
          <HeartRateChart 
            data={dataSource.heartrate || dataSource.heart_rate || []} 
            height={300} 
          />
        </div>
      )}
      
      {hasStepData && (
        <div className="p-4 bg-gray-900 rounded-lg shadow">
          <StepCountChart 
            data={dataSource.steps || []} 
            height={300} 
          />
        </div>
      )}
      
      {hasSleepData && (
        <div className="p-4 bg-gray-900 rounded-lg shadow">
          <SleepChart 
            data={dataSource.sleep || []} 
            height={300} 
          />
        </div>
      )}
    </div>
  );
} 