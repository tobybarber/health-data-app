'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageLayout from '../../components/PageLayout';
import { FaArrowLeft, FaExternalLinkAlt } from 'react-icons/fa';
import Link from 'next/link';

interface Record {
  id: string;
  name: string;
  recordType?: string;
  recordDate?: string;
  url?: string;
  urls?: string[];
  isMultiFile?: boolean;
  analysis?: string;
  briefSummary?: string;
  detailedAnalysis?: string;
  createdAt?: any;
}

export default function RecordPage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecord() {
      if (!currentUser || !id) return;

      try {
        const recordDoc = await getDoc(doc(db, `users/${currentUser.uid}/records/${id}`));
        
        if (!recordDoc.exists()) {
          setError('Record not found');
          return;
        }

        const data = recordDoc.data() as Record;
        setRecord({
          ...data,
          id: recordDoc.id
        });
      } catch (error) {
        console.error('Error loading record:', error);
        setError('Error loading record');
      } finally {
        setLoading(false);
      }
    }

    loadRecord();
  }, [currentUser, id]);

  // Function to format record date as MMM YYYY
  const formatRecordDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <ProtectedRoute>
      <PageLayout title="Record Details">
        <div className="mb-6">
          <button 
            onClick={() => router.back()}
            className="flex items-center text-blue-400 hover:text-blue-300"
          >
            <FaArrowLeft className="mr-2" /> Back to Records
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {record && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 border border-gray-800">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-white mb-2">
                {record.name || record.recordType || 'Unnamed Record'}
              </h1>
              <p className="text-gray-400">
                {formatRecordDate(record.recordDate)}
              </p>
            </div>

            {record.briefSummary && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-white mb-2">Summary</h2>
                <p className="text-gray-300">{record.briefSummary}</p>
              </div>
            )}

            {record.detailedAnalysis && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-white mb-2">Detailed Analysis</h2>
                <div className="text-gray-300 whitespace-pre-wrap">{record.detailedAnalysis}</div>
              </div>
            )}

            {/* File Links */}
            {(record.url || (record.isMultiFile && record.urls)) && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h2 className="text-lg font-medium text-white mb-4">Files</h2>
                
                {record.url && !record.isMultiFile && (
                  <a 
                    href={record.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-400 hover:text-blue-300"
                  >
                    <FaExternalLinkAlt className="mr-2" />
                    View File
                  </a>
                )}

                {record.isMultiFile && record.urls && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {record.urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-400 hover:text-blue-300"
                      >
                        <FaExternalLinkAlt className="mr-2" />
                        File {index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PageLayout>
    </ProtectedRoute>
  );
} 