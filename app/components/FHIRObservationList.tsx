import React from 'react';
import { Observation } from '../types/fhir';

interface FHIRObservationListProps {
  observations: Observation[];
}

export default function FHIRObservationList({ observations }: FHIRObservationListProps) {
  console.log('FHIRObservationList rendering with', observations?.length || 0, 'observations');
  
  if (observations?.length > 0) {
    console.log('First observation:', observations[0]);
  }
  
  // Add the actual component rendering here
  return (
    <div className="space-y-4">
      {observations && observations.length > 0 ? (
        observations.map((observation, index) => (
          <div key={observation.id || index} className="p-3 bg-gray-800 rounded-md">
            <div className="font-medium">{observation.code?.text || 'Unknown Observation'}</div>
            <div className="text-sm text-gray-300 mt-1">
              {observation.valueQuantity ? 
                `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}` : 
                observation.valueString || 'No value'}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-gray-400 py-4">No observations found</div>
      )}
    </div>
  );
} 