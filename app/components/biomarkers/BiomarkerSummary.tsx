'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Activity } from 'lucide-react';
import { getRecentObservationsForBiomarkers, getPatients } from '../../lib/fhir-service';
import { useAuth } from '../../lib/AuthContext';
import { Observation } from '../../types/fhir';

// Mini gauge component for showing biomarker status
function MiniGauge({ 
  value, 
  low, 
  high, 
  unit, 
  status 
}: { 
  value: number, 
  low?: number, 
  high?: number, 
  unit: string,
  status: 'normal' | 'low' | 'high' | 'critical'
}) {
  const statusColors = {
    normal: 'bg-green-500',
    low: 'bg-yellow-500',
    high: 'bg-yellow-500',
    critical: 'bg-red-500'
  };
  
  return (
    <div className="flex flex-col mt-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{value} {unit}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[status]} text-white`}>
          {status === 'normal' ? 'Normal' : status === 'low' ? 'Low' : 'High'}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${statusColors[status]}`} style={{ width: '60%' }}></div>
      </div>
    </div>
  );
}

// Biomarker card component
function BiomarkerCard({ 
  name, 
  value, 
  unit, 
  referenceRange, 
  date, 
  loincCode,
  status = 'normal'
}: { 
  name: string, 
  value: number, 
  unit: string, 
  referenceRange: string, 
  date: string,
  loincCode: string,
  status: 'normal' | 'low' | 'high' | 'critical'
}) {
  const low = referenceRange.split('-')[0]?.trim();
  const high = referenceRange.split('-')[1]?.trim();
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-md">
      <h3 className="text-white font-medium text-sm">{name}</h3>
      <MiniGauge 
        value={value} 
        low={low ? parseFloat(low) : undefined} 
        high={high ? parseFloat(high) : undefined} 
        unit={unit} 
        status={status} 
      />
      <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
        <span>{date}</span>
        <Link 
          href={`/biomarkers/${loincCode}`}
          className="text-blue-400 hover:text-blue-300 flex items-center"
        >
          Details
          <ArrowRight size={12} className="ml-1" />
        </Link>
      </div>
    </div>
  );
}

// Common biomarkers with their LOINC codes
const COMMON_BIOMARKERS = [
  { name: 'Glucose', loincCode: '2339-0' },
  { name: 'Total Cholesterol', loincCode: '2093-3' },
  { name: 'HDL Cholesterol', loincCode: '2085-9' },
  { name: 'LDL Cholesterol', loincCode: '13457-7' },
  { name: 'Hemoglobin', loincCode: '718-7' },
  { name: 'Platelets', loincCode: '26515-7' },
  // Adding additional biomarkers from your existing database
  { name: 'White Blood Cells', loincCode: '6690-2' },  // WBC count
  { name: 'Red Blood Cells', loincCode: '789-8' },     // RBC count
  { name: 'Creatinine', loincCode: '2160-0' },         // Creatinine
  { name: 'Sodium', loincCode: '2951-2' },             // Sodium
  { name: 'Potassium', loincCode: '2823-3' },          // Potassium
  { name: 'Triglycerides', loincCode: '2571-8' },      // Triglycerides
  { name: 'ALT', loincCode: '1742-6' },                // Alanine aminotransferase
  { name: 'AST', loincCode: '1920-8' },                // Aspartate aminotransferase
  { name: 'Alkaline Phosphatase', loincCode: '6768-6' }, // Alk Phos
  { name: 'Bilirubin', loincCode: '1975-2' }           // Total Bilirubin
];

// Main biomarker summary component
export default function BiomarkerSummary({ maxBiomarkers = 6 }: { maxBiomarkers?: number }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchBiomarkers() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        // Find the patient ID for the current user
        let patientId = '';
        
        // First check localStorage (if your app uses this)
        const storedPatientId = localStorage.getItem('patientId');
        if (storedPatientId) {
          patientId = storedPatientId;
          console.log('BiomarkerSummary: Found patient ID in localStorage:', patientId);
        } else {
          // If not in localStorage, try to get the first patient for this user
          console.log('BiomarkerSummary: No patient ID in localStorage, fetching patients...');
          const patients = await getPatients(currentUser.uid);
          console.log('BiomarkerSummary: Patients fetched:', patients?.length || 0);
          
          if (patients && patients.length > 0) {
            patientId = patients[0].id || '';
            console.log('BiomarkerSummary: Using first patient ID:', patientId);
            
            // Store it for future use
            if (patientId) {
              localStorage.setItem('patientId', patientId);
            }
          }
        }
        
        if (!patientId) {
          console.log('BiomarkerSummary: No patient ID found, displaying error');
          setError('No patient records found');
          setLoading(false);
          return;
        }
        
        // Get LOINC codes for common biomarkers
        const loincCodes = COMMON_BIOMARKERS.map(b => b.loincCode);
        console.log('BiomarkerSummary: Searching for LOINC codes:', loincCodes);
        
        // Fetch observations for these biomarkers
        console.log(`BiomarkerSummary: Fetching observations for user ${currentUser.uid}, patient ${patientId}`);
        const observations = await getRecentObservationsForBiomarkers(
          currentUser.uid,
          patientId,
          loincCodes
        );
        console.log('BiomarkerSummary: Observations fetched:', observations?.length || 0);
        
        // Process observations into a suitable format
        const processedBiomarkers = observations.map((obs: Observation) => {
          const biomarkerInfo = COMMON_BIOMARKERS.find(
            b => obs.code?.coding?.some((c: any) => c.code === b.loincCode)
          );
          
          const value = obs.valueQuantity?.value;
          const unit = obs.valueQuantity?.unit || '';
          const date = obs.effectiveDateTime 
            ? new Date(obs.effectiveDateTime).toLocaleDateString()
            : 'Unknown date';
            
          // Get reference range
          const range = obs.referenceRange?.[0];
          const lowValue = range?.low?.value;
          const highValue = range?.high?.value;
          const referenceRange = (lowValue !== undefined && highValue !== undefined)
            ? `${lowValue}-${highValue}`
            : 'Not available';
            
          // Determine status
          let status: 'normal' | 'low' | 'high' | 'critical' = 'normal';
          if (value !== undefined && lowValue !== undefined && highValue !== undefined) {
            if (value < lowValue) {
              status = value < lowValue * 0.8 ? 'critical' : 'low';
            } else if (value > highValue) {
              status = value > highValue * 1.2 ? 'critical' : 'high';
            }
          }
            
          return {
            id: obs.id || '',
            name: biomarkerInfo?.name || obs.code?.coding?.[0]?.display || 'Unknown',
            value,
            unit,
            referenceRange,
            date,
            loincCode: biomarkerInfo?.loincCode || obs.code?.coding?.[0]?.code || '',
            status
          };
        });
        
        console.log('BiomarkerSummary: Processed biomarkers:', processedBiomarkers?.length || 0);
        if (processedBiomarkers?.length > 0) {
          console.log('BiomarkerSummary: First biomarker:', JSON.stringify(processedBiomarkers[0]));
        }
        
        setBiomarkers(processedBiomarkers);
      } catch (err) {
        console.error('Error fetching biomarkers:', err);
        setError('Failed to load biomarkers');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBiomarkers();
  }, [currentUser]);
  
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-4">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Key Biomarkers</h2>
        </div>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-28 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-4">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Key Biomarkers</h2>
        </div>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Key Biomarkers</h2>
          {biomarkers.length > maxBiomarkers && (
            <span className="ml-2 text-xs text-gray-400">Showing {maxBiomarkers} of {biomarkers.length}</span>
          )}
        </div>
        <Link href="/biomarkers" className="text-blue-400 hover:text-blue-300 text-sm">
          View all biomarkers
        </Link>
      </div>
      
      {biomarkers.length === 0 ? (
        <p className="text-gray-400">No biomarker data available.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {biomarkers.slice(0, maxBiomarkers).map((biomarker) => (
            <BiomarkerCard
              key={biomarker.id}
              name={biomarker.name}
              value={biomarker.value}
              unit={biomarker.unit}
              referenceRange={biomarker.referenceRange}
              date={biomarker.date}
              loincCode={biomarker.loincCode}
              status={biomarker.status}
            />
          ))}
        </div>
      )}
    </div>
  );
} 