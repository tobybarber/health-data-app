'use client';

import React from 'react';
import { Observation } from '../types/fhir';

interface InlineObservationGaugeProps {
  observation: Observation;
}

export default function InlineObservationGauge({ observation }: InlineObservationGaugeProps) {
  // Extract data from observation
  const value = observation.valueQuantity?.value;
  const unit = observation.valueQuantity?.unit || '';
  
  // Handle case when there's no numeric value
  if (value === undefined) {
    return null;
  }
  
  // Extract reference ranges if available
  let low = null;
  let high = null;
  
  if (observation.referenceRange && observation.referenceRange.length > 0) {
    const range = observation.referenceRange[0];
    low = range.low?.value;
    high = range.high?.value;
  }
  
  // If no ranges, create default
  if (low === null && high === null) {
    low = value * 0.7;
    high = value * 1.3;
  }
  
  // Ensure low and high are valid numbers
  low = low || value * 0.7;
  high = high || value * 1.3;
  
  // Calculate min/max for display
  const min = Math.min(low * 0.8, value * 0.8);
  const max = Math.max(high * 1.2, value * 1.2);
  const range = max - min;
  
  // Calculate percentage position (0-100%)
  const percentPos = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  
  // Determine color based on whether value is in range
  const inRange = value >= low && value <= high;
  const dotColor = inRange ? 'bg-green-500' : 'bg-yellow-500';
  
  return (
    <div className="mt-2 mb-3">
      <div className="text-xs text-gray-400 mb-1">Reference Range:</div>
      
      {/* Simple, reliable gauge implementation */}
      <div className="h-6 bg-gray-800 rounded-full w-full relative">
        {/* Background gradient */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-yellow-500 to-red-500"></div>
        </div>
        
        {/* Marker for the current value */}
        <div className="absolute top-0 bottom-0 flex items-center pointer-events-none" style={{ left: `${percentPos}%` }}>
          <div className={`w-4 h-4 rounded-full ${dotColor} border-2 border-white shadow transform -translate-x-1/2`}></div>
        </div>
      </div>
      
      {/* Range values */}
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <div>Low: {low.toFixed(1)}</div>
        <div className="text-white">{value.toFixed(1)} {unit}</div>
        <div>High: {high.toFixed(1)}</div>
      </div>
    </div>
  );
} 