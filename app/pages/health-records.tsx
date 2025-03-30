'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  DocumentReference,
  Procedure,
  FamilyMemberHistory,
  ImagingStudy,
  DiagnosticReportImaging
} from '../types/fhir';
import { DocumentList } from '../components/DocumentList';
import { ProcedureList } from '../components/ProcedureList';
import { FamilyHistoryList } from '../components/FamilyHistoryList';
import { ImagingStudyList } from '../components/ImagingStudyList';
import {
  getDocumentReferencesForPatient,
  getProceduresForPatient,
  getFamilyMemberHistoryForPatient,
  getImagingStudiesForPatient
} from '../lib/fhir-service';

export default function HealthRecordsPage() {
  const router = useRouter();
  const { patientId } = router.query;
  
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [familyHistories, setFamilyHistories] = useState<FamilyMemberHistory[]>([]);
  const [imagingStudies, setImagingStudies] = useState<ImagingStudy[]>([]);
  const [imagingReports, setImagingReports] = useState<DiagnosticReportImaging[]>([]);
  const [activeTab, setActiveTab] = useState('documents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Only fetch data if we have a patientId
    if (!patientId) return;
    
    const userId = localStorage.getItem('userId') || '';
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch documents
        const documentData = await getDocumentReferencesForPatient(userId, patientId as string);
        setDocuments(documentData);
        
        // Fetch procedures
        const procedureData = await getProceduresForPatient(userId, patientId as string);
        setProcedures(procedureData);
        
        // Fetch family history
        const familyHistoryData = await getFamilyMemberHistoryForPatient(userId, patientId as string);
        setFamilyHistories(familyHistoryData);
        
        // Fetch imaging studies
        const imagingStudyData = await getImagingStudiesForPatient(userId, patientId as string);
        setImagingStudies(imagingStudyData);
        
        // For simplicity, we're not fetching imaging reports yet
        // This would normally require another API call
        setImagingReports([]);
      } catch (err) {
        console.error('Error fetching health records:', err);
        setError('Failed to load health records. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [patientId]);
  
  // Handle resource viewing
  const handleViewDocument = (document: DocumentReference) => {
    // Open document details or viewer
    console.log('View document:', document);
  };
  
  const handleViewProcedure = (procedure: Procedure) => {
    // Open procedure details
    console.log('View procedure:', procedure);
  };
  
  const handleViewFamilyHistory = (history: FamilyMemberHistory) => {
    // Open family history details
    console.log('View family history:', history);
  };
  
  const handleViewImagingStudy = (study: ImagingStudy) => {
    // Open imaging study details
    console.log('View imaging study:', study);
  };
  
  const handleViewImagingReport = (report: DiagnosticReportImaging) => {
    // Open imaging report details
    console.log('View imaging report:', report);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Health Records</h1>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading health records...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <>
          {/* Tabs for different resource types */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('documents')}
              >
                Documents
                {documents.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                    {documents.length}
                  </span>
                )}
              </button>
              
              <button
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'procedures'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('procedures')}
              >
                Procedures
                {procedures.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                    {procedures.length}
                  </span>
                )}
              </button>
              
              <button
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'family-history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('family-history')}
              >
                Family History
                {familyHistories.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                    {familyHistories.length}
                  </span>
                )}
              </button>
              
              <button
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'imaging'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('imaging')}
              >
                Imaging Studies
                {imagingStudies.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                    {imagingStudies.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
          
          {/* Content for the active tab */}
          <div className="mt-4">
            {activeTab === 'documents' && (
              <div>
                <h2 className="text-lg font-medium mb-4">Medical Documents</h2>
                <DocumentList 
                  documents={documents} 
                  onViewDetails={handleViewDocument}
                />
              </div>
            )}
            
            {activeTab === 'procedures' && (
              <div>
                <h2 className="text-lg font-medium mb-4">Procedures</h2>
                <ProcedureList 
                  procedures={procedures} 
                  onViewDetails={handleViewProcedure}
                />
              </div>
            )}
            
            {activeTab === 'family-history' && (
              <div>
                <h2 className="text-lg font-medium mb-4">Family Medical History</h2>
                <FamilyHistoryList 
                  familyHistories={familyHistories} 
                  onViewDetails={handleViewFamilyHistory}
                />
              </div>
            )}
            
            {activeTab === 'imaging' && (
              <div>
                <h2 className="text-lg font-medium mb-4">Imaging Studies</h2>
                <ImagingStudyList 
                  imagingStudies={imagingStudies}
                  imagingReports={imagingReports}
                  onViewStudy={handleViewImagingStudy}
                  onViewReport={handleViewImagingReport}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 