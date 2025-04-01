'use client';

import React, { useState } from 'react';
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
  // Add state for result explanation
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

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
          {/* Replace continuous gradient with segmented colors */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="h-full w-full flex">
              {/* Below reference range section (red) */}
              <div className="h-full bg-red-500" 
                   style={{ width: `${lowPos}%` }}></div>
              
              {/* Optimal section (green) */}
              <div className="h-full bg-green-500" 
                   style={{ width: `${highPos - lowPos}%` }}></div>
              
              {/* Above reference range section (red) */}
              <div className="h-full bg-red-500" 
                   style={{ width: `${100 - highPos}%` }}></div>
            </div>
          </div>
          
          {/* Range markers */}
          <div className="absolute inset-y-0 left-0 right-0">
            {/* Very Low marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-gray-700"
                 style={{ left: `${veryLowPos}%` }}></div>
            
            {/* Low marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-white/60"
                 style={{ left: `${lowPos}%` }}></div>
            
            {/* High marker */}
            <div className="absolute top-0 bottom-0 border-l-2 border-white/60"
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
      
      {/* Range details - enhance with visual indicators */}
      {showDetails && (
        <div className="mt-4 grid grid-cols-5 gap-1 text-xs">
          <div className="text-center text-red-400 py-1 rounded bg-red-950/30">
            <div className="font-medium">Below Standard</div>
            <div>{`< ${veryLow.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-yellow-400 py-1 rounded bg-yellow-950/30">
            <div className="font-medium">Below Optimal</div>
            <div>{`${veryLow.toFixed(1)} - ${low.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-green-400 py-1 rounded bg-green-950/30">
            <div className="font-medium">Optimal</div>
            <div>{`${low.toFixed(1)} - ${high.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-yellow-400 py-1 rounded bg-yellow-950/30">
            <div className="font-medium">Above Optimal</div>
            <div>{`${high.toFixed(1)} - ${veryHigh.toFixed(1)}`}</div>
          </div>
          <div className="text-center text-red-400 py-1 rounded bg-red-950/30">
            <div className="font-medium">Above Standard</div>
            <div>{`> ${veryHigh.toFixed(1)}`}</div>
          </div>
        </div>
      )}
      
      {/* Link to more information - replaced with result explanation */}
      <div className="mt-4 text-center">
        {!showExplanation ? (
          <button 
            onClick={async () => {
              setShowExplanation(true);
              
              // Only fetch explanation if we don't already have one
              if (!explanation) {
                setIsLoadingExplanation(true);
                
                try {
                  // Prepare question for OpenAI
                  const testName = observationName || 'lab test';
                  const testValue = value !== undefined ? value : 'unknown';
                  const testUnit = unit || '';
                  
                  const question = `Tell me about a result of ${testValue}${testUnit} on a ${testName} test as though you are explaining it to a patient. This will be used for informational purposes only and not as medical advice. Just start the response without any introductory words, like "okay" or "certainly".`;
                  
                  // Call OpenAI API
                  const response = await fetch('/api/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: question })
                  });
                  
                  if (!response.ok) {
                    throw new Error('Failed to get explanation');
                  }
                  
                  const data = await response.json();
                  setExplanation(data.result || 'Sorry, I could not generate an explanation for this result.');
                } catch (error) {
                  console.error('Error getting explanation:', error);
                  setExplanation('Sorry, there was an error generating an explanation for this result.');
                } finally {
                  setIsLoadingExplanation(false);
                }
              }
            }}
            className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center"
          >
            Learn more about this result
            <ExternalLinkIcon className="ml-1 h-3 w-3" />
          </button>
        ) : (
          <div className="text-left mt-4">
            <h4 className="font-medium text-white text-sm mb-2">About This Result:</h4>
            {isLoadingExplanation ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-sm text-gray-300">Getting explanation...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-300 p-3 bg-gray-800 rounded-md">
                {explanation}
              </div>
            )}
            <div className="flex space-x-4 mt-2">
              <button 
                onClick={() => setShowExplanation(false)}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                Hide explanation
              </button>
              <button 
                onClick={async () => {
                  setIsLoadingExplanation(true);
                  
                  try {
                    // Prepare question for OpenAI
                    const testName = observationName || 'lab test';
                    const testValue = value !== undefined ? value : 'unknown';
                    const testUnit = unit || '';
                    
                    const question = `Tell me about a result of ${testValue}${testUnit} on a ${testName} test as though you are explaining it to a patient. This will be used for informational purposes only and not as medical advice. Just start the response without any introductory words, like "okay" or "certainly".`;
                    
                    // Call OpenAI API
                    const response = await fetch('/api/openai', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: question })
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to get explanation');
                    }
                    
                    const data = await response.json();
                    setExplanation(data.result || 'Sorry, I could not generate an explanation for this result.');
                  } catch (error) {
                    console.error('Error getting explanation:', error);
                    setExplanation('Sorry, there was an error generating an explanation for this result.');
                  } finally {
                    setIsLoadingExplanation(false);
                  }
                }}
                className="text-blue-400 hover:text-blue-300 text-xs flex items-center"
                disabled={isLoadingExplanation}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh explanation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 