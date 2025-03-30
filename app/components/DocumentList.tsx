'use client';

import React, { useState } from 'react';
import { DocumentReference } from '../types/fhir';
import { CalendarIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import Link from 'next/link';

interface DocumentListProps {
  documents: DocumentReference[];
  onViewDetails?: (document: DocumentReference) => void;
}

export function DocumentList({ documents, onViewDetails }: DocumentListProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        No documents found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {documents.map((document) => (
        <DocumentCard 
          key={document.id} 
          document={document} 
          onViewDetails={onViewDetails} 
        />
      ))}
    </div>
  );
}

interface DocumentCardProps {
  document: DocumentReference;
  onViewDetails?: (document: DocumentReference) => void;
}

function DocumentCard({ document, onViewDetails }: DocumentCardProps) {
  const [showFhirData, setShowFhirData] = useState(false);
  
  // Get document title
  const title = document.content?.[0]?.attachment?.title || 
                document.type?.text || 
                'Medical Document';
  
  // Get document type/category
  const category = document.category?.[0]?.text || 
                  document.type?.coding?.[0]?.display || 
                  'Document';
  
  // Get document date
  const date = document.date ? 
    new Date(document.date).toLocaleDateString() : 
    'Unknown date';
  
  // Get document URL if available
  const documentUrl = document.content?.[0]?.attachment?.url;
  
  const toggleFhirData = () => {
    setShowFhirData(!showFhirData);
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-800 border border-slate-700 text-gray-100 shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <div className="px-2 py-1 rounded-md bg-blue-900/30 text-blue-300 text-xs">
            {category}
          </div>
        </div>
        <div className="flex items-center mt-1 text-gray-400 text-sm">
          <CalendarIcon className="mr-1 h-3 w-3" />
          {date}
        </div>
      </div>
      <div className="p-4 flex-grow">
        <p className="text-sm text-gray-300 line-clamp-3">
          {document.description || 'No description available'}
        </p>
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
              {JSON.stringify(document, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="flex justify-between p-4 border-t border-slate-700">
        {documentUrl && (
          <Link 
            href={documentUrl} 
            target="_blank"
            className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm bg-slate-700 border border-slate-600 text-gray-200 hover:bg-slate-600 hover:text-white"
          >
            <ExternalLinkIcon className="mr-1 h-4 w-4" />
            View Document
          </Link>
        )}
        {onViewDetails && (
          <button 
            onClick={() => onViewDetails(document)}
            className="text-sm text-blue-300 hover:text-blue-200 hover:bg-slate-700 rounded-md px-3 h-9"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
} 