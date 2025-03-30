'use client';

import React, { useState } from 'react';
import { FamilyMemberHistory } from '../types/fhir';
import { formatDate } from '../utils/date-utils';

interface FamilyHistoryListProps {
  familyHistories: FamilyMemberHistory[];
  onViewDetails?: (history: FamilyMemberHistory) => void;
}

export function FamilyHistoryList({ familyHistories, onViewDetails }: FamilyHistoryListProps) {
  if (!familyHistories || familyHistories.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        No family history records found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {familyHistories.map((history) => (
        <FamilyHistoryCard 
          key={history.id} 
          history={history} 
          onViewDetails={onViewDetails} 
        />
      ))}
    </div>
  );
}

interface FamilyHistoryCardProps {
  history: FamilyMemberHistory;
  onViewDetails?: (history: FamilyMemberHistory) => void;
}

function FamilyHistoryCard({ history, onViewDetails }: FamilyHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Get relationship
  const relationship = history.relationship?.text || 
                      history.relationship?.coding?.[0]?.display || 
                      'Family member';
  
  // Get name if available
  const name = history.name || relationship;
  
  // Get conditions
  const conditions = history.condition || [];
  
  // Get birth date if available
  const birthDate = history.bornDate ? 
    formatDate(new Date(history.bornDate)) : 
    undefined;
  
  // Get deceased status
  const isDeceased = history.deceasedBoolean || 
                     history.deceasedDate || 
                     history.deceasedString;
  
  // Get deceased date if available
  const deceasedDate = history.deceasedDate ? 
    formatDate(new Date(history.deceasedDate)) : 
    undefined;
  
  // Get sex if available
  const sex = history.sex?.text ||
             history.sex?.coding?.[0]?.display ||
             undefined;
  
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">{name}</h3>
          {relationship !== name && (
            <p className="text-sm text-gray-500">{relationship}</p>
          )}
        </div>
        
        {isDeceased && (
          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
            Deceased {deceasedDate ? `(${deceasedDate})` : ''}
          </span>
        )}
      </div>
      
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {sex && (
          <div className="flex items-center space-x-2">
            <span className="font-medium">Sex:</span>
            <span>{sex}</span>
          </div>
        )}
        
        {birthDate && (
          <div className="flex items-center space-x-2">
            <span className="font-medium">Birth Date:</span>
            <span>{birthDate}</span>
          </div>
        )}
        
        {history.ageString && (
          <div className="flex items-center space-x-2">
            <span className="font-medium">Age:</span>
            <span>{history.ageString}</span>
          </div>
        )}
      </div>
      
      {conditions.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Conditions:</h4>
            {conditions.length > 2 && (
              <button 
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>
          
          <ul className="mt-1 space-y-2">
            {conditions
              .slice(0, expanded ? conditions.length : 2)
              .map((condition, index) => (
                <li key={index} className="text-sm">
                  <div className="font-medium">{condition.code?.text || 'Unknown condition'}</div>
                  
                  <div className="flex flex-wrap gap-x-4 text-xs text-gray-500 mt-1">
                    {condition.onsetString && (
                      <span>Onset: {condition.onsetString}</span>
                    )}
                    
                    {condition.outcome && (
                      <span>Outcome: {condition.outcome.text}</span>
                    )}
                    
                    {condition.contributedToDeath && (
                      <span className="text-red-600">Contributed to death</span>
                    )}
                  </div>
                </li>
              ))}
            
            {!expanded && conditions.length > 2 && (
              <li className="text-xs text-gray-500">
                {conditions.length - 2} more condition(s)...
              </li>
            )}
          </ul>
        </div>
      )}
      
      {onViewDetails && (
        <button
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
          onClick={() => onViewDetails(history)}
        >
          View Details
        </button>
      )}
    </div>
  );
} 