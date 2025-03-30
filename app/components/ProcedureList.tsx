'use client';

import React, { useState } from 'react';
import { Procedure } from '../types/fhir';
import { ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';

interface ProcedureListProps {
  procedures: Procedure[];
  onViewDetails?: (procedure: Procedure) => void;
}

export function ProcedureList({ procedures, onViewDetails }: ProcedureListProps) {
  if (!procedures || procedures.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        No procedures found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {procedures.map((procedure) => (
        <ProcedureCard 
          key={procedure.id} 
          procedure={procedure} 
          onViewDetails={onViewDetails} 
        />
      ))}
    </div>
  );
}

interface ProcedureCardProps {
  procedure: Procedure;
  onViewDetails?: (procedure: Procedure) => void;
}

function ProcedureCard({ procedure, onViewDetails }: ProcedureCardProps) {
  const [showFhirData, setShowFhirData] = useState(false);
  
  // Get procedure name/title
  const title = procedure.code?.text || 'Procedure';
  
  // Get procedure date
  const date = procedure.performedDateTime ? 
    new Date(procedure.performedDateTime).toLocaleDateString() : 
    'Unknown date';
  
  // Get procedure status
  const statusMap: Record<string, string> = {
    'preparation': 'Planned',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'entered-in-error': 'Error',
    'stopped': 'Stopped',
    'unknown': 'Unknown'
  };
  const status = statusMap[procedure.status] || 'Unknown';
  
  // Get procedure performer
  const performer = procedure.performer?.[0]?.actor?.display || 'Unknown provider';
  
  // Get location
  const location = procedure.location?.display || '';
  
  const toggleFhirData = () => {
    setShowFhirData(!showFhirData);
  };
  
  return (
    <div className="border border-slate-700 rounded-lg shadow-sm bg-slate-800 text-gray-100">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(procedure.status)}`}>
            {status}
          </span>
        </div>
        
        <div className="mt-2 text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-400">Date:</span>
            <span>{date}</span>
          </div>
          
          <div className="flex items-center space-x-2 mt-1">
            <span className="font-medium text-gray-400">Provider:</span>
            <span>{performer}</span>
          </div>
          
          {location && (
            <div className="flex items-center space-x-2 mt-1">
              <span className="font-medium text-gray-400">Location:</span>
              <span>{location}</span>
            </div>
          )}
        </div>
        
        {procedure.reasonCode && procedure.reasonCode.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-400">Reason:</p>
            <p className="text-sm text-gray-300">
              {procedure.reasonCode[0].text || 'Unknown reason'}
            </p>
          </div>
        )}
        
        {procedure.outcome && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-400">Outcome:</p>
            <p className="text-sm text-gray-300">
              {procedure.outcome.text || 'Unknown outcome'}
            </p>
          </div>
        )}
        
        {onViewDetails && (
          <button
            className="mt-4 text-sm text-blue-300 hover:text-blue-200 font-medium"
            onClick={() => onViewDetails(procedure)}
          >
            View Details
          </button>
        )}
      </div>
      
      {/* FHIR Data Section */}
      <div className="border-t border-slate-700">
        <button 
          onClick={toggleFhirData}
          className="w-full flex items-center justify-between px-4 py-2 text-sm text-blue-300 hover:bg-slate-700"
        >
          <span>View FHIR Data</span>
          {showFhirData ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
        
        {showFhirData && (
          <div className="p-4 border-t border-slate-700 bg-slate-900">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-blue-300">FHIR Resource Data</h4>
              <button 
                onClick={() => setShowFhirData(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <pre className="text-xs text-gray-300 bg-slate-950 p-3 rounded-md overflow-auto max-h-96">
              {JSON.stringify(procedure, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-900/50 text-green-300';
    case 'in-progress':
      return 'bg-blue-900/50 text-blue-300';
    case 'preparation':
      return 'bg-purple-900/50 text-purple-300';
    case 'stopped':
      return 'bg-red-900/50 text-red-300';
    case 'entered-in-error':
      return 'bg-red-900/50 text-red-300';
    default:
      return 'bg-slate-700 text-gray-300';
  }
} 