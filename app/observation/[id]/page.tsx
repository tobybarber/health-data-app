'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import ObservationGauge from '../../components/ObservationGauge';
import FHIRObservationChart from '../../components/FHIRObservationChart';
import { Observation } from '../../types/fhir';
import { ArrowLeftIcon, Activity, BarChart2 } from 'lucide-react';

// Function to properly format the test name from FHIR Observation
function getFormattedTestName(observation: Observation): string {
  // Check for specific observation IDs we want to map to readable names
  const idMappings: Record<string, string> = {
    'observation-hemoglobin': 'Hemoglobin',
    'observation-wcc': 'White Cell Count',
    'observation-platelets': 'Platelets',
    'observation-neutrophils': 'Neutrophils',
    'observation-lymphocytes': 'Lymphocytes',
    'observation-sodium': 'Sodium',
    'observation-potassium': 'Potassium',
    'observation-creatinine': 'Creatinine',
    'observation-glucose': 'Glucose',
    'mild-neutropenia': 'Neutrophil Count',
    'fbe-20250221': 'Neutrophil Count'
  };

  // If we have a direct ID mapping, use it
  if (observation.id && idMappings[observation.id]) {
    return idMappings[observation.id];
  }

  // Check if the observation has LOINC coding with a display name
  if (observation.code?.coding) {
    // Try to find LOINC code
    const loincCoding = observation.code.coding.find(coding => 
      coding.system === 'http://loinc.org' ||
      coding.system?.includes('loinc')
    );
    
    // If LOINC coding exists and has a display name, use it
    if (loincCoding?.display) {
      // Clean up the display name - some LOINC names are verbose
      const cleanedName = loincCoding.display
        .replace(/\[.+?\]/g, '')  // Remove anything in brackets
        .replace(/\(.+?\)/g, '')  // Remove anything in parentheses
        .replace(/:\s*$/, '')     // Remove trailing colons
        .replace(/mass\/volume/i, '')
        .replace(/in blood/i, '')
        .replace(/in serum or plasma/i, '')
        .replace(/\s{2,}/g, ' ')  // Replace multiple spaces with a single space
        .trim();
      
      if (cleanedName) return cleanedName;
    }
    
    // If no LOINC code, use any other coding system's display name
    for (const coding of observation.code.coding) {
      if (coding.display) {
        return coding.display;
      }
    }
  }
  
  // If code.text exists (plain text name), use it
  if (observation.code?.text) {
    return observation.code.text;
  }
  
  // Extract name from observation ID if possible
  if (observation.id) {
    // Remove prefixes like 'observation-'
    let idName = observation.id.replace(/^(observation-|obs-|lab-)/i, '');
    
    // Replace dashes with spaces and capitalize words
    idName = idName.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Expand common abbreviations
    const abbreviations: Record<string, string> = {
      'Hb': 'Hemoglobin',
      'Wcc': 'White Cell Count',
      'Plt': 'Platelets',
      'Neut': 'Neutrophils',
      'Lymph': 'Lymphocytes',
      'Na': 'Sodium',
      'K': 'Potassium',
      'Creat': 'Creatinine',
      'Gluc': 'Glucose',
      'Mcv': 'Mean Cell Volume',
      'Mchc': 'Mean Cell Hemoglobin Concentration'
    };
    
    for (const [abbr, full] of Object.entries(abbreviations)) {
      if (idName.includes(abbr)) {
        return full;
      }
    }
    
    return idName;
  }
  
  // Fallback to "Lab Test" if nothing else works
  return 'Lab Test';
}

export default function ObservationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);

  useEffect(() => {
    async function fetchObservation() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const observationId = Array.isArray(id) ? id[0] : id;
        
        // First try the direct path in the 'fhir' collection (current structure)
        let observationRef = doc(db, 'users', currentUser.uid, 'fhir', observationId);
        let observationSnap = await getDoc(observationRef);
        
        // If not found, try the alternative path (possibly older structure)
        if (!observationSnap.exists()) {
          console.log(`Observation not found at direct path, trying prefixed path...`);
          observationRef = doc(db, 'users', currentUser.uid, 'fhir_resources', `Observation_${observationId}`);
          observationSnap = await getDoc(observationRef);
        }
        
        if (observationSnap.exists()) {
          console.log(`Observation found:`, observationSnap.data());
          const data = observationSnap.data();
          // Ensure the ID is set correctly
          const observationData = { ...data, id: observationId } as Observation;
          console.log(`Formatted test name:`, getFormattedTestName(observationData));
          setObservation(observationData);
        } else {
          console.error(`Observation not found with ID: ${observationId}`);
          setError('Observation not found');
        }
      } catch (err: any) {
        console.error('Error fetching observation:', err);
        setError(err.message || 'Failed to load observation data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchObservation();
  }, [currentUser, id]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        <Navigation />
        
        <main className="container max-w-4xl mx-auto px-4 pt-20 pb-16">
          <button 
            onClick={() => router.back()}
            className="flex items-center text-blue-400 hover:text-blue-300 mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back
          </button>
          
          {loading && (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          {observation && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-primary-blue">
                  {getFormattedTestName(observation)}
                </h1>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowTrend(false)}
                    className={`px-3 py-1.5 rounded-md flex items-center text-sm ${
                      !showTrend ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    <Activity className="w-4 h-4 mr-1.5" />
                    Range View
                  </button>
                  
                  <button
                    onClick={() => setShowTrend(true)}
                    className={`px-3 py-1.5 rounded-md flex items-center text-sm ${
                      showTrend ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4 mr-1.5" />
                    Trend View
                  </button>
                </div>
              </div>
              
              {/* Observation Date */}
              {observation.effectiveDateTime && (
                <div className="text-gray-400">
                  Date: {new Date(observation.effectiveDateTime).toLocaleDateString()}
                </div>
              )}
              
              {/* Observation Gauge or Chart */}
              {!showTrend ? (
                <ObservationGauge observation={observation} title={getFormattedTestName(observation)} />
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-white mb-4">Historical Trend</h2>
                  <FHIRObservationChart
                    patientId={observation.subject?.reference?.split('/')[1] || ''}
                    loincCode={observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code || ''}
                    title={getFormattedTestName(observation)}
                    height={300}
                    width={600}
                  />
                </div>
              )}
              
              {/* Additional Details */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-white mb-4">Additional Details</h2>
                
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {/* Test Name */}
                  <div className="py-1">
                    <dt className="text-gray-400">Test Name:</dt>
                    <dd className="text-white font-medium">{getFormattedTestName(observation)}</dd>
                  </div>
                  
                  {/* Test Category */}
                  <div className="py-1">
                    <dt className="text-gray-400">Category:</dt>
                    <dd className="text-white font-medium">
                      {observation.category && observation.category.length > 0 ? 
                        (observation.category[0]?.text || 
                         observation.category[0]?.coding?.[0]?.display || 
                         'Laboratory') : 'Laboratory'}
                    </dd>
                  </div>
                  
                  {observation.category?.map((cat, index) => (
                    cat.coding && cat.coding.length > 0 && cat.coding[0]?.display !== 'Laboratory' && (
                      <div key={`category-${index}`} className="py-1">
                        <dt className="text-gray-400">{cat.coding[0]?.system?.split('/').pop() || 'Category'}:</dt>
                        <dd className="text-white font-medium">{cat.coding[0]?.display || cat.text || 'Unknown'}</dd>
                      </div>
                    )
                  ))}
                  
                  {observation.code?.coding?.map((coding, index) => (
                    <div key={`coding-${index}`} className="py-1">
                      <dt className="text-gray-400">{coding.system?.split('/').pop()}:</dt>
                      <dd className="text-white font-medium">{coding.code} - {coding.display}</dd>
                    </div>
                  ))}
                  
                  {observation.valueQuantity && (
                    <div className="py-1">
                      <dt className="text-gray-400">Value:</dt>
                      <dd className="text-white font-medium">
                        {observation.valueQuantity.value} {observation.valueQuantity.unit || ''}
                        {observation.valueQuantity.system && ` (${observation.valueQuantity.system})`}
                      </dd>
                    </div>
                  )}
                  
                  {observation.referenceRange?.map((range, index) => (
                    <div key={`range-${index}`} className="py-1">
                      <dt className="text-gray-400">Reference Range:</dt>
                      <dd className="text-white font-medium">
                        {range.low?.value !== undefined && range.high?.value !== undefined && 
                          `${range.low.value} - ${range.high.value} ${range.high.unit || ''}`}
                        {range.low?.value !== undefined && range.high?.value === undefined && 
                          `> ${range.low.value} ${range.low.unit || ''}`}
                        {range.low?.value === undefined && range.high?.value !== undefined && 
                          `< ${range.high.value} ${range.high.unit || ''}`}
                      </dd>
                    </div>
                  ))}
                  
                  {observation.interpretation?.map((interp, index) => (
                    <div key={`interp-${index}`} className="py-1">
                      <dt className="text-gray-400">Interpretation:</dt>
                      <dd className="text-white font-medium">
                        {interp.text || interp.coding?.[0]?.display || interp.coding?.[0]?.code || 'Unknown'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              
              {/* FHIR Details */}
              <details className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <summary className="text-white font-medium cursor-pointer">View FHIR Data</summary>
                <pre className="mt-4 p-3 bg-black rounded overflow-auto text-xs text-gray-300">
                  {JSON.stringify(observation, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
} 