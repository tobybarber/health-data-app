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
import PageLayout from '../../components/PageLayout';

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
      <PageLayout 
        title={observation ? getFormattedTestName(observation) : 'Loading...'}
      >
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
            </div>
            
            {/* Observation Date */}
            {observation.effectiveDateTime && (
              <div className="text-gray-400">
                Date: {new Date(observation.effectiveDateTime).toLocaleDateString()}
              </div>
            )}
            
            {/* Range View Section */}
            <div>
              <div className="flex items-center mb-2">
                <Activity className="w-5 h-5 mr-2 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Range View</h2>
              </div>
              <ObservationGauge observation={observation} title={getFormattedTestName(observation)} />
            </div>
            
            {/* Trend View Section */}
            <div>
              <div className="flex items-center mb-2">
                <BarChart2 className="w-5 h-5 mr-2 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Historical Trend</h2>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <FHIRObservationChart
                  patientId={observation.subject?.reference?.split('/')[1] || ''}
                  loincCode={observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code || ''}
                  title={getFormattedTestName(observation)}
                  height={200}
                  width={600}
                />
              </div>
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
      </PageLayout>
    </ProtectedRoute>
  );
} 