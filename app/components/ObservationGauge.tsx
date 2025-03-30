'use client';

import React from 'react';
import { Observation } from '../types/fhir';
import { ExternalLinkIcon } from 'lucide-react';

interface ObservationGaugeProps {
  observation: Observation;
  title?: string;
  showDetails?: boolean;
}

export default function ObservationGauge({ 
  observation, 
  title, 
  showDetails = true 
}: ObservationGaugeProps) {
  // Extract data from observation
  const observationName = title || observation.code?.text || 'Lab Test';
  const value = observation.valueQuantity?.value;
  const unit = observation.valueQuantity?.unit || '';
  const system = observation.code?.coding?.[0]?.system || '';
  const code = observation.code?.coding?.[0]?.code || '';
  
  // Handle case when there's no numeric value
  if (value === undefined) {
    return (
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
        <h3 className="text-lg font-medium text-white">{observationName}</h3>
        <p className="text-gray-400 mt-1">No numeric value available</p>
      </div>
    );
  }

  // Extract reference ranges
  let low = null;
  let high = null;
  let veryLow = null;
  let veryHigh = null;
  
  if (observation.referenceRange && observation.referenceRange.length > 0) {
    // Normal range
    const normalRange = observation.referenceRange.find(range => 
      !range.type || range.type.coding?.some(c => c.code === 'normal'));
    
    if (normalRange) {
      low = normalRange.low?.value;
      high = normalRange.high?.value;
    }
    
    // Critical/extreme ranges
    const criticalLowRange = observation.referenceRange.find(range => 
      range.type?.coding?.some(c => c.code === 'critical-low'));
    const criticalHighRange = observation.referenceRange.find(range => 
      range.type?.coding?.some(c => c.code === 'critical-high'));
    
    if (criticalLowRange) veryLow = criticalLowRange.high?.value;
    if (criticalHighRange) veryHigh = criticalHighRange.low?.value;
  }
  
  // If no reference ranges defined, try to infer from common lab tests
  if (low === null && high === null) {
    if (code === '2339-0' || observationName.toLowerCase().includes('glucose')) {
      // Glucose
      veryLow = 50; low = 65; high = 99; veryHigh = 300;
    } else if (code === '4548-4' || observationName.toLowerCase().includes('hemoglobin a1c')) {
      // HbA1c
      veryLow = 4.0; low = 4.5; high = 5.7; veryHigh = 8.1;
    } else if (code === '1920-8' || observationName.toLowerCase().includes('sctlr') || observationName.toLowerCase().includes('creatinine')) {
      // SCTLR Creatinine
      veryLow = 0.5; low = 0.6; high = 1.3; veryHigh = 2.0;
    } else if (code === '2160-0' || observationName.toLowerCase().includes('creatinine')) {
      // Creatinine
      veryLow = 0.5; low = 0.6; high = 1.3; veryHigh = 2.0;
    } else if (code === '751-8' || observationName.toLowerCase().includes('neutrophils')) {
      // Neutrophils
      veryLow = 1.5; low = 2.0; high = 7.0; veryHigh = 10.0;
    } else if (code === '17861-6' || observationName.toLowerCase().includes('calcium')) {
      // Calcium
      veryLow = 8.0; low = 8.5; high = 10.5; veryHigh = 12.0;
    } else if (code === '2823-3' || observationName.toLowerCase().includes('potassium')) {
      // Potassium
      veryLow = 3.0; low = 3.5; high = 5.0; veryHigh = 6.0;
    } else if (code === '2951-2' || observationName.toLowerCase().includes('sodium')) {
      // Sodium
      veryLow = 130; low = 135; high = 145; veryHigh = 150;
    } else if (code === '2744-1' || observationName.toLowerCase().includes('pH')) {
      // pH
      veryLow = 7.1; low = 7.35; high = 7.45; veryHigh = 7.7;
    } else if (code === '789-8' || observationName.toLowerCase().includes('rbc') || observationName.toLowerCase().includes('red blood')) {
      // RBC
      veryLow = 3.5; low = 4.2; high = 5.8; veryHigh = 6.5;
    } else if (code === '718-7' || observationName.toLowerCase().includes('hemoglobin')) {
      // Hemoglobin
      if (unit?.toLowerCase().includes('g/dl')) {
        veryLow = 10; low = 12; high = 16; veryHigh = 18;
      }
    }
  }
  
  // If still no ranges, create a sensible default centered around the value
  if (low === null && high === null) {
    const range = value * 0.5;
    low = value - range;
    high = value + range;
    veryLow = low - range;
    veryHigh = high + range;
  }
  
  // Ensure we have values for very low/high
  if (veryLow === null) veryLow = low ? low * 0.5 : value * 0.5;
  if (veryHigh === null) veryHigh = high ? high * 1.5 : value * 1.5;
  
  // Ensure all values are numbers (not null)
  veryLow = veryLow || 0;
  low = low || 0;
  high = high || 0;
  veryHigh = veryHigh || 0;
  
  // Calculate the min and max for the scale
  const min = Math.min(veryLow, value * 0.5);
  const max = Math.max(veryHigh, value * 1.5);
  const range = max - min;
  
  // Calculate positions for each marker (0-100%)
  const getPosition = (val: number) => ((val - min) / range) * 100;
  
  const veryLowPos = getPosition(veryLow);
  const lowPos = getPosition(low);
  const highPos = getPosition(high);
  const veryHighPos = getPosition(veryHigh);
  const valuePos = getPosition(value);
  
  // Determine the status category
  let status = 'Optimal';
  let statusColor = 'text-green-500';
  
  if (value < veryLow) {
    status = 'Below Standard';
    statusColor = 'text-red-500';
  } else if (value < low) {
    status = 'Below Optimal';
    statusColor = 'text-yellow-500';
  } else if (value > veryHigh) {
    status = 'Above Standard';
    statusColor = 'text-red-500';
  } else if (value > high) {
    status = 'Above Optimal';
    statusColor = 'text-yellow-500';
  }
  
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-medium text-white">{observationName}</h3>
          <p className="text-sm text-gray-400">{system && code ? `${system.split('/').pop()}: ${code}` : ''}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
          </div>
          <div className={`text-sm font-medium ${statusColor}`}>
            {status}
          </div>
        </div>
      </div>
      
      {/* Gauge visualization */}
      <div className="mt-4 mb-2">
        <div className="relative h-8">
          {/* Background gradient */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-yellow-500 to-red-500"
                 style={{
                   backgroundSize: '200% 100%',
                   backgroundPosition: '0% 0%'
                 }}></div>
          </div>
          
          {/* Range markers */}
          <div className="absolute inset-y-0 left-0 right-0">
            {/* Very Low marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-gray-700"
                 style={{ left: `${veryLowPos}%` }}></div>
            
            {/* Low marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-gray-700"
                 style={{ left: `${lowPos}%` }}></div>
            
            {/* High marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-gray-700"
                 style={{ left: `${highPos}%` }}></div>
            
            {/* Very High marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-gray-700"
                 style={{ left: `${veryHighPos}%` }}></div>
          </div>
          
          {/* Current value marker */}
          <div className="absolute top-0 bottom-0 flex items-center"
               style={{ left: `${valuePos}%` }}>
            <div className="w-6 h-6 rounded-full bg-white border-4 border-gray-800 shadow-lg transform -translate-x-1/2"></div>
          </div>
        </div>
        
        {/* Range labels */}
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <div>{min.toFixed(1)}</div>
          <div>{max.toFixed(1)} {unit}</div>
        </div>
      </div>
      
      {/* Range details */}
      {showDetails && (
        <div className="mt-4 grid grid-cols-5 gap-1 text-xs">
          <div className="text-center text-red-400">
            <div className="font-medium">Below Standard</div>
            <div>{`< ${veryLow.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-yellow-400">
            <div className="font-medium">Below Optimal</div>
            <div>{`${veryLow.toFixed(1)} - ${low.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-green-400">
            <div className="font-medium">Optimal</div>
            <div>{`${low.toFixed(1)} - ${high.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-yellow-400">
            <div className="font-medium">Above Optimal</div>
            <div>{`${high.toFixed(1)} - ${veryHigh.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-red-400">
            <div className="font-medium">Above Standard</div>
            <div>{`> ${veryHigh.toFixed(1)}`}</div>
          </div>
        </div>
      )}
      
      {/* Link to more information */}
      <div className="mt-4 text-center">
        <a 
          href={`https://labtestsonline.org/tests/${code || observationName.toLowerCase().replace(/\s+/g, '-')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center"
        >
          Learn more about this test
          <ExternalLinkIcon className="ml-1 h-3 w-3" />
        </a>
      </div>
    </div>
  );
} 