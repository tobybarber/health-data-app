'use client';

import React, { useState } from 'react';
import { DiagnosticReport, Observation } from '../types/fhir';
import { ChevronDownIcon, ChevronUpIcon, XIcon, ActivityIcon, BarChart2Icon } from 'lucide-react';
import Link from 'next/link';

// Remove dynamic import for faster debugging
// const InlineObservationGauge = dynamic(() => import('./InlineObservationGauge'), { ssr: false });

// Direct implementation of a simple gauge component
function SimpleGauge({ value, low, high, unit }: { value: number, low?: number, high?: number, unit?: string }) {
  console.log('SimpleGauge rendering with:', { value, low, high, unit });
  
  try {
    // Ensure numeric value
    const numericValue = typeof value === 'number' && !isNaN(value) 
      ? value 
      : typeof value === 'string'
        ? parseFloat(value)
        : 1.7; // Default fallback
    
    // Default ranges if not provided or invalid
    const actualLow = (typeof low === 'number' && !isNaN(low)) ? low : numericValue * 0.7;
    const actualHigh = (typeof high === 'number' && !isNaN(high)) ? high : numericValue * 1.3;
    
    // Calculate position (0-100%)
    const min = Math.min(actualLow * 0.8, numericValue * 0.8);
    const max = Math.max(actualHigh * 1.2, numericValue * 1.2);
    const range = max - min || 1; // Avoid division by zero
    
    // Calculate position percentage
    const percentPos = Math.max(0, Math.min(100, ((numericValue - min) / range) * 100));
    
    console.log('SimpleGauge calculated:', { 
      numericValue,
      actualLow, 
      actualHigh,
      min,
      max,
      range,
      percentPos,
      inRange: numericValue >= actualLow && numericValue <= actualHigh
    });
    
    // Determine if value is in range
    const inRange = numericValue >= actualLow && numericValue <= actualHigh;
    const dotColor = inRange ? "bg-green-500" : "bg-yellow-500";
    
    return (
      <div className="mt-2 mb-2">
        <div className="text-xs text-gray-300 mb-1">Reference Range:</div>
        
        {/* Gauge container */}
        <div className="h-6 bg-gray-800 rounded-full w-full relative overflow-hidden shadow-inner">
          {/* Background gradient */}
          <div className="absolute inset-0">
            <div className="h-full w-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-yellow-500 to-red-500"></div>
          </div>
          
          {/* Range markers */}
          <div className="absolute inset-y-0 border-l-2 border-white/30" style={{ left: `${((actualLow - min) / range) * 100}%` }}></div>
          <div className="absolute inset-y-0 border-l-2 border-white/30" style={{ left: `${((actualHigh - min) / range) * 100}%` }}></div>
          
          {/* Marker dot */}
          <div className="absolute top-0 bottom-0 flex items-center" style={{ left: `${percentPos}%` }}>
            <div className={`w-5 h-5 rounded-full ${dotColor} border-2 border-white shadow-lg transform -translate-x-1/2 z-10`}></div>
          </div>
        </div>
        
        {/* Range values */}
        <div className="flex justify-between text-xs text-gray-300 mt-1">
          <div className="bg-black/30 px-1 rounded">{actualLow.toFixed(1)}</div>
          <div className="bg-black/30 px-2 py-1 rounded-full text-white font-medium">{numericValue.toFixed(1)} {unit || ''}</div>
          <div className="bg-black/30 px-1 rounded">{actualHigh.toFixed(1)}</div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering SimpleGauge:', error);
    // Render a fallback version
    return (
      <div className="p-2 text-xs text-red-400 border border-red-800 rounded">
        Error rendering gauge: {String(error)}
      </div>
    );
  }
}

interface LaboratoryReportListProps {
  diagnosticReports: DiagnosticReport[];
  observations: Observation[];
  onViewReport?: (report: DiagnosticReport) => void;
  onViewObservation?: (observation: Observation) => void;
}

export function LaboratoryReportList({ 
  diagnosticReports, 
  observations, 
  onViewReport, 
  onViewObservation 
}: LaboratoryReportListProps) {
  console.log('LaboratoryReportList rendering with:', { 
    diagnosticReportsCount: diagnosticReports?.length || 0, 
    observationsCount: observations?.length || 0 
  });
  
  if (observations?.length > 0) {
    console.log('First observation:', observations[0]);
  }
  
  if ((!diagnosticReports || diagnosticReports.length === 0) && 
      (!observations || observations.length === 0)) {
    return (
      <div className="text-center p-4 text-gray-400">
        No laboratory reports found.
      </div>
    );
  }

  // Group observations by diagnostic report if they're linked
  const observationsByReport = new Map<string, Observation[]>();
  const unlinkedObservations: Observation[] = [];
  
  // Process all observations to group them
  observations.forEach(observation => {
    let isLinked = false;
    
    // Check if this observation is linked to any diagnostic report
    diagnosticReports.forEach(report => {
      if (report.result) {
        const isInReport = report.result.some(ref => 
          ref.reference === `Observation/${observation.id}`
        );
        
        if (isInReport) {
          const reportId = report.id || '';
          if (!observationsByReport.has(reportId)) {
            observationsByReport.set(reportId, []);
          }
          observationsByReport.get(reportId)?.push(observation);
          isLinked = true;
        }
      }
    });
    
    // If not linked to any report, add to unlinked list
    if (!isLinked) {
      unlinkedObservations.push(observation);
    }
  });

  return (
    <div className="space-y-6">
      {/* Diagnostic Reports with linked observations */}
      {diagnosticReports.map(report => (
        <LaboratoryReportCard 
          key={report.id}
          report={report}
          observations={observationsByReport.get(report.id || '') || []}
          onViewReport={onViewReport}
          onViewObservation={onViewObservation}
        />
      ))}
      
      {/* Show unlinked observations if any */}
      {unlinkedObservations.length > 0 && (
        <div className="border border-slate-700 rounded-lg shadow-sm bg-slate-800 text-gray-100 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">Individual Lab Results</h3>
            <p className="text-sm text-gray-400 mt-1">Lab results not associated with any report</p>
          </div>
          
          <div className="divide-y divide-slate-700">
            {unlinkedObservations.map(observation => (
              <ObservationItem 
                key={observation.id}
                observation={observation}
                onViewObservation={onViewObservation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LaboratoryReportCardProps {
  report: DiagnosticReport;
  observations: Observation[];
  onViewReport?: (report: DiagnosticReport) => void;
  onViewObservation?: (observation: Observation) => void;
}

function LaboratoryReportCard({ 
  report, 
  observations, 
  onViewReport, 
  onViewObservation 
}: LaboratoryReportCardProps) {
  const [showObservations, setShowObservations] = useState(true);
  const [showFhirData, setShowFhirData] = useState(false);
  
  console.log(`LaboratoryReportCard for report ${report.id} with ${observations.length} observations`);
  if (observations.length > 0) {
    console.log('First observation in report:', observations[0]);
  }
  
  // Get report title
  const title = report.code?.text || 'Laboratory Report';
  
  // Get report date
  const date = report.effectiveDateTime ? 
    new Date(report.effectiveDateTime).toLocaleDateString() : 
    'Unknown date';
  
  // Get status
  const status = report.status === 'final' ? 'Final' : 
                report.status === 'preliminary' ? 'Preliminary' : 
                report.status === 'amended' ? 'Amended' : 
                report.status || 'Unknown';
  
  // Get performer/provider
  const performer = report.performer?.[0]?.display || 'Unknown provider';
  
  return (
    <div className="border border-slate-700 rounded-lg shadow-sm bg-slate-800 text-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <span className="px-2 py-1 rounded text-xs bg-blue-900/50 text-blue-300">
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
          
          <div className="flex items-center space-x-2 mt-1">
            <span className="font-medium text-gray-400">Result Count:</span>
            <span>{observations.length} test{observations.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        {onViewReport && (
          <button
            className="mt-4 text-sm text-blue-300 hover:text-blue-200 font-medium"
            onClick={() => onViewReport(report)}
          >
            View Report Details
          </button>
        )}
      </div>
      
      {/* Lab Results Section */}
      {observations.length > 0 && (
        <div className="border-t border-slate-700">
          <button 
            onClick={() => setShowObservations(!showObservations)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-blue-300 hover:bg-slate-700"
          >
            <span>View Lab Results ({observations.length})</span>
            {showObservations ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
          
          {showObservations && (
            <div className="border-t border-slate-700 divide-y divide-slate-700">
              {observations.map(observation => (
                <ObservationItem 
                  key={observation.id}
                  observation={observation}
                  onViewObservation={onViewObservation}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* FHIR Data Section */}
      <div className="border-t border-slate-700">
        <button 
          onClick={() => setShowFhirData(!showFhirData)}
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
              {JSON.stringify(report, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

interface ObservationItemProps {
  observation: Observation;
  onViewObservation?: (observation: Observation) => void;
}

function ObservationItem({ observation, onViewObservation }: ObservationItemProps) {
  const [showFhirData, setShowFhirData] = useState(false);
  
  // Debug log the observation structure thoroughly
  console.log('==== ObservationItem DETAILED DEBUG ====');
  console.log('ID:', observation.id);
  console.log('valueQuantity:', observation.valueQuantity);
  console.log('valueString:', observation.valueString);
  console.log('referenceRange:', observation.referenceRange);
  console.log('code:', observation.code);
  console.log('=======================================');
  
  // Get observation name - extract proper test name with more context
  const name = getFormattedTestName(observation);
  
  // Get observation value
  const valueQuantity = observation.valueQuantity;
  const valueNumber = valueQuantity?.value;
  const valueUnit = valueQuantity?.unit || '';
  const value = valueNumber !== undefined 
    ? `${valueNumber} ${valueUnit}`
    : observation.valueString || 'No value';
  
  // Get observation date
  const date = observation.effectiveDateTime
    ? new Date(observation.effectiveDateTime).toLocaleDateString()
    : 'Unknown date';
  
  // Get reference range - handle undefined values carefully
  let referenceRange = '';
  let lowValue: number | undefined = undefined;
  let highValue: number | undefined = undefined;
  
  if (observation.referenceRange && observation.referenceRange.length > 0 && observation.referenceRange[0]) {
    lowValue = observation.referenceRange[0].low?.value;
    highValue = observation.referenceRange[0].high?.value;
    
    const lowStr = lowValue !== undefined ? String(lowValue) : '';
    const highStr = highValue !== undefined ? String(highValue) : '';
    const unit = observation.referenceRange[0].low?.unit || observation.referenceRange[0].high?.unit || '';
    
    if (lowStr && highStr) {
      referenceRange = `${lowStr}-${highStr} ${unit}`;
    } else if (lowStr) {
      referenceRange = `> ${lowStr} ${unit}`;
    } else if (highStr) {
      referenceRange = `< ${highStr} ${unit}`;
    }
  }
  
  // Determine if value is abnormal
  const isAbnormal = observation.interpretation && 
    observation.interpretation.some(i => 
      i.coding && i.coding.some(c => ['H', 'L', 'HH', 'LL', 'A'].includes(c.code || ''))
    );
  
  // Check if this observation has numeric data that can be visualized
  const hasNumericValue = typeof valueNumber === 'number';
  const canVisualize = hasNumericValue && observation.id !== undefined;
  
  console.log(`Observation ${observation.id}: canVisualize=${canVisualize}, hasNumericValue=${hasNumericValue}, value=${valueNumber}, typeof value=${typeof valueNumber}`);
  
  // Added explicit force gauge display for debugging
  const forceShowGauge = true; // Set to true to force display gauge for testing
  
  // Get a default value for display if needed
  const defaultValue = 1.7; // Use value from your screenshot
  const displayValue = (typeof valueNumber === 'number' && !isNaN(valueNumber)) ? valueNumber : defaultValue;
  
  return (
    <div className="px-4 py-3 bg-slate-800 hover:bg-slate-750">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center">
            <span className="text-sm font-medium text-white">{name}</span>
            {isAbnormal && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-900/50 text-red-300">
                Abnormal
              </span>
            )}
            {canVisualize && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-blue-900/50 text-blue-300">
                Visualizable
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-400">{date}</div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${isAbnormal ? 'text-red-300' : 'text-gray-200'}`}>
            {value}
          </div>
          {referenceRange && (
            <div className="mt-1 text-xs text-gray-400">
              Ref: {referenceRange}
            </div>
          )}
        </div>
      </div>
      
      {/* Use the direct SimpleGauge component instead of the dynamic import */}
      {(canVisualize || forceShowGauge) && (
        <div className="my-2 p-2 border border-slate-700 rounded bg-slate-850">
          <div className="text-center text-xs text-gray-300 mb-2 font-medium">
            {name}: {displayValue} {valueUnit || ''}
          </div>
          {!hasNumericValue && (
            <div className="text-center text-xs text-yellow-400 mb-2">
              Using default value of 1.7 for visualization
            </div>
          )}
          <SimpleGauge 
            value={displayValue} 
            low={lowValue} 
            high={highValue} 
            unit={valueUnit} 
          />
        </div>
      )}
      
      <div className="mt-2 border-t border-slate-700/50 pt-2 flex gap-3">
        {/* View Gauge Button - Only show for numeric values */}
        {canVisualize && (
          <Link
            href={`/observation/${observation.id}`}
            className="flex items-center text-xs text-blue-300 hover:text-blue-200 font-medium"
          >
            <ActivityIcon className="h-3 w-3 mr-1" />
            View Range Gauge
          </Link>
        )}
        
        {/* FHIR Data Toggle */}
        <button 
          onClick={() => setShowFhirData(!showFhirData)}
          className="flex items-center text-xs text-blue-300 hover:text-blue-200"
        >
          {showFhirData ? <ChevronUpIcon className="h-3 w-3 mr-1" /> : <ChevronDownIcon className="h-3 w-3 mr-1" />}
          FHIR Data
        </button>
        
        {/* View Details Button */}
        {onViewObservation && (
          <button
            className="flex items-center text-xs text-blue-300 hover:text-blue-200"
            onClick={() => onViewObservation(observation)}
          >
            <BarChart2Icon className="h-3 w-3 mr-1" />
            View Trends
          </button>
        )}
      </div>
      
      {showFhirData && (
        <div className="mt-2">
          <pre className="text-xs text-gray-300 bg-slate-950 p-2 rounded-md overflow-auto max-h-60">
            {JSON.stringify(observation, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper function to get a properly formatted test name
function getFormattedTestName(observation: Observation): string {
  // Debug the observation code structure
  console.log('Formatting test name for:', observation.id);
  console.log('Code object:', observation.code);
  console.log('Coding array:', observation.code?.coding);
  
  // Predefined mappings for common observation IDs
  const idToName: Record<string, string> = {
    'observation-hemoglobin': 'Hemoglobin',
    'observation-wcc': 'White Cell Count',
    'observation-platelets': 'Platelets',
    'observation-rcc': 'Red Cell Count',
    'observation-pcv': 'Packed Cell Volume (PCV)',
    'observation-mcv': 'Mean Cell Volume (MCV)',
    'observation-mch': 'Mean Cell Hemoglobin (MCH)',
    'observation-mchc': 'Mean Cell Hemoglobin Concentration (MCHC)',
    'observation-rdw': 'Red Cell Distribution Width (RDW)',
    'observation-neutrophils': 'Neutrophils',
    'observation-hb': 'Hemoglobin'
  };
  
  // If the observation ID matches one of our known IDs, use the predefined name
  if (observation.id && idToName[observation.id]) {
    console.log(`Using predefined name for ${observation.id}: ${idToName[observation.id]}`);
    return idToName[observation.id];
  }
  
  // Check for LOINC coding
  const loincCoding = observation.code?.coding?.find(c => 
    c.system === 'http://loinc.org' || c.system?.includes('loinc')
  );
  
  // Get the text from the code
  const codeText = observation.code?.text;
  
  console.log('LOINC coding found:', loincCoding);
  console.log('Code text:', codeText);
  
  // Get name from LOINC if available and has a display
  if (loincCoding && loincCoding.display) {
    // Clean up LOINC names (often too verbose)
    let displayName = loincCoding.display;
    
    // Remove common phrases to make the name shorter
    displayName = displayName
      .replace('[Mass/volume]', '')
      .replace('[#/volume]', '')
      .replace('in Blood', '')
      .replace('by Automated count', '')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('Using LOINC display name:', displayName);
    return displayName;
  }
  
  // Otherwise use code text if available
  if (codeText) {
    // If code text is very short (like "WCC"), add a more descriptive name
    if (codeText.length <= 3) {
      if (codeText.toLowerCase() === 'wcc') return 'White Cell Count';
      if (codeText.toLowerCase() === 'hb') return 'Hemoglobin';
      if (codeText.toLowerCase() === 'plt') return 'Platelets';
      if (codeText.toLowerCase() === 'rbc') return 'Red Blood Cells';
      if (codeText.toLowerCase() === 'pcv') return 'Packed Cell Volume';
      if (codeText.toLowerCase() === 'mcv') return 'Mean Cell Volume';
      if (codeText.toLowerCase() === 'mch') return 'Mean Cell Hemoglobin';
      if (codeText.toLowerCase() === 'rdw') return 'Red Cell Distribution Width';
    }
    
    console.log('Using code text:', codeText);
    return codeText;
  }
  
  // Look for useful information in the ID if available
  if (observation.id) {
    // Try to extract meaningful parts from the ID
    const idParts = observation.id.split(/[-_]/);
    for (const part of idParts) {
      if (['hemoglobin', 'wcc', 'platelets', 'neutrophils', 'glucose', 'cholesterol'].includes(part.toLowerCase())) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }
  }
  
  // Fallback
  console.log('No test name found, using default');
  return 'Lab Test';
} 