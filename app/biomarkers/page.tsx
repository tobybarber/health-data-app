'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import Navigation from '../components/Navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { Activity, ArrowLeft, ArrowRight } from 'lucide-react';
import { getRecentObservationsForBiomarkers, getPatients, createObservation } from '../lib/fhir-service';
import { Observation } from '../types/fhir';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Common biomarkers with their LOINC codes
const BIOMARKERS = [
  { name: 'Complete Blood Count', biomarkers: [
    { name: 'Hemoglobin', loincCode: '718-7', description: 'Oxygen-carrying protein in red blood cells' },
    { name: 'Platelets', loincCode: '26515-7', description: 'Cells that help blood clot' },
    { name: 'White Blood Cells', loincCode: '6690-2', description: 'Cells that fight infection' },
    { name: 'Red Blood Cells', loincCode: '789-8', description: 'Cells that carry oxygen' },
  ]},
  { name: 'Metabolic Panel', biomarkers: [
    { name: 'Glucose', loincCode: '2339-0', description: 'Blood sugar level' },
    { name: 'Creatinine', loincCode: '2160-0', description: 'Kidney function marker' },
    { name: 'Sodium', loincCode: '2951-2', description: 'Electrolyte balance' },
    { name: 'Potassium', loincCode: '2823-3', description: 'Electrolyte balance' },
  ]},
  { name: 'Lipid Panel', biomarkers: [
    { name: 'Total Cholesterol', loincCode: '2093-3', description: 'Blood fat measurement' },
    { name: 'HDL Cholesterol', loincCode: '2085-9', description: 'Good cholesterol' },
    { name: 'LDL Cholesterol', loincCode: '13457-7', description: 'Bad cholesterol' },
    { name: 'Triglycerides', loincCode: '2571-8', description: 'Blood fat storage' },
  ]},
  { name: 'Liver Function', biomarkers: [
    { name: 'ALT', loincCode: '1742-6', description: 'Liver enzyme' },
    { name: 'AST', loincCode: '1920-8', description: 'Liver enzyme' },
    { name: 'Alkaline Phosphatase', loincCode: '6768-6', description: 'Liver/bone enzyme' },
    { name: 'Bilirubin', loincCode: '1975-2', description: 'Liver waste product' },
  ]},
];

export default function BiomarkersPage() {
  const { currentUser } = useAuth();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add ref for scroll to debug section
  const debugSectionRef = useRef<HTMLDivElement>(null);
  
  const scrollToDebug = () => {
    debugSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    async function fetchBiomarkers() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        // Find the patient ID for the current user
        let patientId = '';
        
        const storedPatientId = localStorage.getItem('patientId');
        if (storedPatientId) {
          patientId = storedPatientId;
        } else {
          const patients = await getPatients(currentUser.uid);
          if (patients && patients.length > 0) {
            patientId = patients[0].id || '';
            if (patientId) {
              localStorage.setItem('patientId', patientId);
            }
          }
        }
        
        if (!patientId) {
          setError('No patient records found');
          setLoading(false);
          return;
        }
        
        // Get all LOINC codes from our biomarker definitions
        const loincCodes = BIOMARKERS.flatMap(group => 
          group.biomarkers.map(b => b.loincCode)
        );
        
        // Fetch observations for all biomarkers
        const observationData = await getRecentObservationsForBiomarkers(
          currentUser.uid,
          patientId,
          loincCodes
        );
        
        setObservations(observationData);
      } catch (err) {
        console.error('Error fetching biomarkers:', err);
        setError('Failed to load biomarkers');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBiomarkers();
  }, [currentUser]);
  
  // Helper function to find observation for a specific biomarker
  const findObservation = (loincCode: string) => {
    return observations.find(obs => 
      obs.code?.coding?.some(c => c.code === loincCode)
    );
  };
  
  // Helper function to determine status class
  const getStatusClass = (obs: Observation | undefined) => {
    if (!obs || !obs.valueQuantity?.value) return 'bg-gray-500';
    
    const value = obs.valueQuantity.value;
    const range = obs.referenceRange?.[0];
    const low = range?.low?.value;
    const high = range?.high?.value;
    
    if (low !== undefined && value < low) {
      return value < low * 0.8 ? 'bg-red-500' : 'bg-yellow-500';
    } else if (high !== undefined && value > high) {
      return value > high * 1.2 ? 'bg-red-500' : 'bg-yellow-500';
    }
    
    return 'bg-green-500';
  };
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        <Navigation />
        
        <main className="container mx-auto px-4 pt-20 pb-8">
          <div className="mb-6">
            <Link href="/analysis" className="text-blue-400 hover:text-blue-300 flex items-center">
              <ArrowLeft size={16} className="mr-1" />
              Back to Analysis
            </Link>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary-blue">Biomarkers</h1>
          </div>
          
          {loading ? (
            <div className="animate-pulse space-y-6">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="h-7 bg-gray-800 rounded w-1/4 mb-4"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-24 bg-gray-800 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {BIOMARKERS.map((group, groupIndex) => (
                <div key={groupIndex} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-400" />
                    {group.name}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.biomarkers.map((biomarker, index) => {
                      const observation = findObservation(biomarker.loincCode);
                      const value = observation?.valueQuantity?.value;
                      const unit = observation?.valueQuantity?.unit || '';
                      const date = observation?.effectiveDateTime 
                        ? new Date(observation.effectiveDateTime).toLocaleDateString() 
                        : '';
                      
                      const statusClass = getStatusClass(observation);
                      const range = observation?.referenceRange?.[0];
                      const referenceRange = (range?.low?.value !== undefined && range?.high?.value !== undefined)
                        ? `${range.low.value}-${range.high.value} ${range.high.unit || ''}`
                        : 'Not available';
                      
                      return (
                        <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-md">
                          <div className="flex justify-between items-center">
                            <h3 className="text-white font-medium">{biomarker.name}</h3>
                            {value !== undefined && (
                              <div className={`w-3 h-3 rounded-full ${statusClass}`}></div>
                            )}
                          </div>
                          
                          <p className="text-gray-400 text-xs mt-1">{biomarker.description}</p>
                          
                          {value !== undefined ? (
                            <div className="mt-2">
                              <div className="text-white font-medium text-lg">
                                {value} {unit}
                              </div>
                              <div className="text-gray-400 text-xs">
                                Reference: {referenceRange}
                              </div>
                              {date && (
                                <div className="text-gray-400 text-xs mt-1">
                                  {date}
                                </div>
                              )}
                              
                              <Link 
                                href={`/biomarkers/${biomarker.loincCode}`}
                                className="text-blue-400 hover:text-blue-300 text-xs flex items-center mt-2"
                              >
                                View details
                                <ArrowRight size={12} className="ml-1" />
                              </Link>
                            </div>
                          ) : (
                            <div className="mt-3 text-gray-500 italic text-sm">
                              No data available
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Debug Button to show all FHIR resources */}
          <div className="mt-8 border-t border-gray-800 pt-4" ref={debugSectionRef}>
            <h2 className="text-xl font-semibold text-primary-blue mb-4">Debug Tools</h2>
            <button
              onClick={async () => {
                if (!currentUser) return;
                
                try {
                  // Get all resources from FHIR collection
                  const collectionRef = collection(db, 'users', currentUser.uid, 'fhir_resources');
                  const querySnapshot = await getDocs(collectionRef);
                  
                  console.log(`Found ${querySnapshot.size} total FHIR resources`);
                  
                  // Extract all LOINC codes we're interested in
                  const biomarkerLOINCcodes = BIOMARKERS.flatMap(group => 
                    group.biomarkers.map(b => b.loincCode)
                  );
                  console.log('Looking for these LOINC codes:', biomarkerLOINCcodes);
                  
                  // Group resources by type
                  const resourcesByType: Record<string, number> = {};
                  
                  // Only collect Observation resources with LOINC codes
                  const observationResources: any[] = [];
                  
                  querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.resourceType) {
                      resourcesByType[data.resourceType] = (resourcesByType[data.resourceType] || 0) + 1;
                      
                      // For Observation resources, collect more details
                      if (data.resourceType === 'Observation') {
                        const loincCoding = data.code?.coding?.find((c: any) => c.system === 'http://loinc.org');
                        const loincCode = loincCoding?.code;
                        
                        if (loincCode && biomarkerLOINCcodes.includes(loincCode)) {
                          const value = data.valueQuantity?.value;
                          const unit = data.valueQuantity?.unit;
                          const name = data.code?.text || loincCoding?.display || 'Unknown';
                          
                          observationResources.push({
                            id: data.id,
                            name,
                            loincCode,
                            value,
                            unit,
                            date: data.effectiveDateTime,
                            subject: data.subject?.reference
                          });
                        }
                      }
                    }
                  });
                  
                  console.log('Resources by type:', resourcesByType);
                  console.log(`Found ${observationResources.length} biomarker-related observations`);
                  console.log('Biomarker observations:', observationResources);
                  
                  // Create a summary of found vs. missing biomarkers
                  const biomarkerStatus: Record<string, { found: boolean, name: string, loincCode: string }> = {};
                  
                  BIOMARKERS.forEach(group => {
                    group.biomarkers.forEach(biomarker => {
                      biomarkerStatus[biomarker.loincCode] = {
                        found: observationResources.some(obs => obs.loincCode === biomarker.loincCode),
                        name: biomarker.name,
                        loincCode: biomarker.loincCode
                      };
                    });
                  });
                  
                  const foundBiomarkers = Object.values(biomarkerStatus).filter(b => b.found);
                  const missingBiomarkers = Object.values(biomarkerStatus).filter(b => !b.found);
                  
                  let message = `Found ${querySnapshot.size} total FHIR resources.\n`;
                  message += `${observationResources.length} are biomarker observations with matching LOINC codes.\n\n`;
                  message += `Found ${foundBiomarkers.length} biomarkers: ${foundBiomarkers.map(b => b.name).join(', ')}\n\n`;
                  message += `Missing ${missingBiomarkers.length} biomarkers: ${missingBiomarkers.map(b => b.name).join(', ')}`;
                  
                  alert(message);
                  
                } catch (err) {
                  console.error('Error fetching FHIR resources:', err);
                  alert('Error fetching FHIR resources. Check the console for details.');
                }
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Debug: Analyze Biomarker Data
            </button>
          </div>

          <button
            onClick={async () => {
              if (!currentUser) return;
              
              try {
                // Find the patient ID for the current user
                let patientId = localStorage.getItem('patientId');
                
                if (!patientId) {
                  // If not in localStorage, try to get the first patient for this user
                  const patients = await getPatients(currentUser.uid);
                  if (patients && patients.length > 0) {
                    patientId = patients[0].id || '';
                    
                    if (patientId) {
                      localStorage.setItem('patientId', patientId);
                    }
                  }
                }
                
                if (!patientId) {
                  alert('No patient found. Please create a patient record first.');
                  return;
                }
                
                // Import necessary functions
                const { createObservation } = await import('../lib/fhir-service');
                
                // Create sample biomarker observations
                const sampleBiomarkers = [
                  {
                    name: 'Glucose',
                    loincCode: '2339-0',
                    value: 90,
                    unit: 'mg/dL',
                    low: 70,
                    high: 110
                  },
                  {
                    name: 'Cholesterol',
                    loincCode: '2093-3',
                    value: 195,
                    unit: 'mg/dL',
                    low: 150,
                    high: 200
                  },
                  {
                    name: 'HDL',
                    loincCode: '2085-9',
                    value: 62,
                    unit: 'mg/dL',
                    low: 40,
                    high: 60
                  },
                  {
                    name: 'LDL',
                    loincCode: '13457-7',
                    value: 110,
                    unit: 'mg/dL',
                    low: 0,
                    high: 130
                  },
                  {
                    name: 'Hemoglobin',
                    loincCode: '718-7',
                    value: 14.2,
                    unit: 'g/dL',
                    low: 12,
                    high: 16
                  },
                  {
                    name: 'Platelets',
                    loincCode: '26515-7',
                    value: 250,
                    unit: '×10^9/L',
                    low: 150,
                    high: 450
                  }
                ];
                
                // Create each observation
                const results = [];
                for (const biomarker of sampleBiomarkers) {
                  const observationData = {
                    status: 'final' as const,
                    code: {
                      coding: [
                        {
                          system: 'http://loinc.org',
                          code: biomarker.loincCode,
                          display: biomarker.name
                        }
                      ],
                      text: biomarker.name
                    },
                    valueQuantity: {
                      value: biomarker.value,
                      unit: biomarker.unit,
                      system: 'http://unitsofmeasure.org',
                      code: biomarker.unit
                    },
                    referenceRange: [
                      {
                        low: { value: biomarker.low, unit: biomarker.unit },
                        high: { value: biomarker.high, unit: biomarker.unit }
                      }
                    ],
                    effectiveDateTime: new Date().toISOString()
                  };
                  
                  const id = await createObservation(currentUser.uid, observationData, patientId);
                  results.push(id);
                }
                
                console.log('Created sample biomarkers with IDs:', results);
                alert(`Created ${results.length} sample biomarker observations. Refresh the page to see them.`);
                
              } catch (err) {
                console.error('Error creating sample biomarkers:', err);
                alert('Error creating sample biomarkers. Check the console for details.');
              }
            }}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create Sample Biomarkers
          </button>
        </main>
        
        {/* Floating Scroll to Debug button - moved to top right */}
        <div className="fixed top-20 right-6 z-50">
          <button
            onClick={scrollToDebug}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center"
          >
            <span>Debug Tools</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L11 12.586V5a1 1 0 112 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
} 