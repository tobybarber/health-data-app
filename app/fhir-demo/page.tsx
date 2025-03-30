'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { createPatient, createObservation, getPatients } from '../lib/fhir-service';
import { getLoincCode, parseObservationValue } from '../lib/fhir-converter';
import FHIRObservationChart from '../components/FHIRObservationChart';
import ProtectedRoute from '../components/ProtectedRoute';
import { Patient, Observation, ObservationReferenceRange } from '../types/fhir';

interface LabTestData {
  name: string;
  value: number;
  unit: string;
  date: string;
  referenceRange?: {
    low: number;
    high: number;
  };
}

export default function FHIRDemoPage() {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any[]>([]);
  
  // Demo data
  const demoLabTests: LabTestData[] = [
    { 
      name: 'Ferritin', 
      value: 120, 
      unit: 'ng/mL', 
      date: '2023-01-15',
      referenceRange: { low: 20, high: 300 }
    },
    { 
      name: 'Hemoglobin', 
      value: 14.2, 
      unit: 'g/dL', 
      date: '2023-01-15',
      referenceRange: { low: 12, high: 16 }
    },
    { 
      name: 'Iron', 
      value: 85, 
      unit: 'µg/dL', 
      date: '2023-01-15',
      referenceRange: { low: 60, high: 170 }
    },
    { 
      name: 'Vitamin D', 
      value: 32, 
      unit: 'ng/mL', 
      date: '2023-01-15',
      referenceRange: { low: 30, high: 100 }
    }
  ];
  
  const demoHistoricalData: LabTestData[] = [
    { name: 'Ferritin', value: 80, unit: 'ng/mL', date: '2022-07-10' },
    { name: 'Ferritin', value: 95, unit: 'ng/mL', date: '2022-10-22' },
    { name: 'Ferritin', value: 120, unit: 'ng/mL', date: '2023-01-15' },
    { name: 'Ferritin', value: 135, unit: 'ng/mL', date: '2023-04-05' },
    { name: 'Ferritin', value: 145, unit: 'ng/mL', date: '2023-07-18' },
    { name: 'Hemoglobin', value: 13.1, unit: 'g/dL', date: '2022-07-10' },
    { name: 'Hemoglobin', value: 13.5, unit: 'g/dL', date: '2022-10-22' },
    { name: 'Hemoglobin', value: 14.2, unit: 'g/dL', date: '2023-01-15' },
    { name: 'Hemoglobin', value: 13.9, unit: 'g/dL', date: '2023-04-05' },
    { name: 'Hemoglobin', value: 14.5, unit: 'g/dL', date: '2023-07-18' }
  ];
  
  useEffect(() => {
    async function loadPatients() {
      if (!currentUser) return;
      
      try {
        const patientsList = await getPatients(currentUser.uid);
        setPatients(patientsList);
        
        if (patientsList.length > 0) {
          setSelectedPatientId(patientsList[0].id || '');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading patients:', error);
        setLoading(false);
      }
    }
    
    loadPatients();
  }, [currentUser]);
  
  // Convert lab test data to FHIR Observation format
  function labTestToObservation(test: LabTestData): Partial<Observation> {
    const observation: Partial<Observation> = {
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: getLoinCodeForTest(test.name),
          display: test.name
        }],
        text: test.name
      },
      effectiveDateTime: test.date,
      valueQuantity: {
        value: test.value,
        unit: test.unit,
        system: 'http://unitsofmeasure.org',
        code: test.unit
      }
    };
    
    // Add reference range if available
    if (test.referenceRange) {
      const range: ObservationReferenceRange = {
        low: {
          value: test.referenceRange.low,
          unit: test.unit,
          system: 'http://unitsofmeasure.org',
          code: test.unit
        },
        high: {
          value: test.referenceRange.high,
          unit: test.unit,
          system: 'http://unitsofmeasure.org',
          code: test.unit
        }
      };
      
      observation.referenceRange = [range];
    }
    
    return observation;
  }
  
  // Get LOINC code for common lab tests
  function getLoinCodeForTest(testName: string): string {
    const lowerTestName = testName.toLowerCase();
    
    // Simple mapping for demo
    if (lowerTestName.includes('ferritin')) return '2276-4';
    if (lowerTestName.includes('hemoglobin')) return '718-7';
    if (lowerTestName.includes('iron')) return '2498-4';
    if (lowerTestName.includes('vitamin d')) return '35365-6';
    
    return 'unknown';
  }
  
  async function handleCreatePatient() {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Create a demo patient
      const patientId = await createPatient(currentUser.uid, {
        name: [
          {
            family: 'Demo',
            given: ['Patient'],
            text: 'Demo Patient'
          }
        ],
        gender: 'unknown',
        birthDate: '1990-01-01'
      });
      
      // Create observations for this patient
      const createdObservations = [];
      
      // Create recent lab tests
      for (const test of demoLabTests) {
        const obsData = labTestToObservation(test);
        const obsId = await createObservation(
          currentUser.uid,
          obsData,
          patientId
        );
        createdObservations.push(obsId);
      }
      
      // Create historical data
      for (const historical of demoHistoricalData) {
        const obsData = labTestToObservation(historical);
        const obsId = await createObservation(
          currentUser.uid,
          obsData,
          patientId
        );
        createdObservations.push(obsId);
      }
      
      // Reload patients
      const patientsList = await getPatients(currentUser.uid);
      setPatients(patientsList);
      setSelectedPatientId(patientId);
      
      setMessage(`Created patient and ${createdObservations.length} observations`);
      
      // Store test results for display
      setTestResults([
        { type: 'Patient', id: patientId },
        ...createdObservations.map(id => ({ type: 'Observation', id }))
      ]);
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error creating demo data:', error);
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    }
  }
  
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 bg-gray-100">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">FHIR Demo</h1>
        
        <div className="bg-gray-800 text-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">FHIR Resources</h2>
          
          {loading ? (
            <p>Loading...</p>
          ) : patients.length === 0 ? (
            <div>
              <p className="mb-4">No patients found. Create a demo patient with sample lab data.</p>
              <button
                onClick={handleCreatePatient}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={loading}
              >
                Create Demo Patient with Lab Data
              </button>
            </div>
          ) : (
            <div>
              <label className="block mb-2">
                Select Patient:
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="ml-2 border rounded p-1 bg-gray-700 text-white border-gray-600"
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name?.[0]?.text || 'Unnamed Patient'}
                    </option>
                  ))}
                </select>
              </label>
              
              {selectedPatientId && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Lab Test Trends</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FHIRObservationChart
                      patientId={selectedPatientId}
                      loincCode="2276-4"
                      title="Ferritin Levels"
                      subtitle="Serum ferritin measurements over time"
                    />
                    
                    <FHIRObservationChart
                      patientId={selectedPatientId}
                      loincCode="718-7"
                      title="Hemoglobin Levels"
                      subtitle="Blood hemoglobin measurements over time"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {message && (
            <div className={`mt-4 p-3 rounded ${message.startsWith('Error') ? 'bg-red-700 text-white' : 'bg-green-700 text-white'}`}>
              {message}
            </div>
          )}
          
          {testResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Created FHIR Resources</h3>
              <div className="bg-gray-900 p-4 rounded overflow-auto max-h-60">
                <pre className="text-xs text-gray-300">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-gray-800 text-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">About This FHIR Implementation</h2>
          <p className="mb-4">
            This demo showcases a basic FHIR implementation with the following features:
          </p>
          <ul className="list-disc pl-5 mb-4 space-y-2">
            <li>Support for key FHIR resources: Patient, Observation, and DiagnosticReport</li>
            <li>RESTful API following FHIR specifications</li>
            <li>Proper resource references and integrity</li>
            <li>Use of standard terminologies (LOINC codes for lab tests)</li>
            <li>Visualization of time-series data from FHIR Observations</li>
          </ul>
          <p>
            The implementation stores FHIR resources in Firebase Firestore using the pattern:
            <code className="bg-gray-900 px-2 py-1 rounded ml-2 text-green-300">
              /users/{'{userId}'}/fhir_resources/{'{resourceType}_{id}'}
            </code>
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
} 