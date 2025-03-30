'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navigation from '../../components/Navigation';
import { collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CleanupPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [orphanedResources, setOrphanedResources] = useState<{id: string, type: string}[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);

  useEffect(() => {
    if (currentUser) {
      findOrphanedResources();
    }
  }, [currentUser]);

  const findOrphanedResources = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setMessage('Scanning for orphaned FHIR resources...');
    
    try {
      // Get all FHIR resources
      const fhirResourcesRef = collection(db, 'users', currentUser.uid, 'fhir_resources');
      const fhirSnapshot = await getDocs(fhirResourcesRef);
      const fhirResources = fhirSnapshot.docs.map(doc => ({
        id: doc.id,
        type: doc.id.split('_')[0] || 'Unknown'
      }));
      
      // Get all records with their FHIR resource IDs
      const recordsRef = collection(db, 'users', currentUser.uid, 'records');
      const recordsSnapshot = await getDocs(recordsRef);
      
      // Collect all referenced FHIR resource IDs
      const referencedIds = new Set<string>();
      recordsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fhirResourceIds && Array.isArray(data.fhirResourceIds)) {
          data.fhirResourceIds.forEach((id: string) => referencedIds.add(id));
        }
      });
      
      // Find orphaned resources (those not referenced by any record)
      const orphaned = fhirResources.filter(resource => !referencedIds.has(resource.id));
      
      setOrphanedResources(orphaned);
      setMessage(`Found ${orphaned.length} orphaned FHIR resources.`);
    } catch (error) {
      console.error('Error finding orphaned resources:', error);
      setMessage(`Error finding orphaned resources: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResources(prev => 
      prev.includes(resourceId) 
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const selectAll = () => {
    setSelectedResources(orphanedResources.map(r => r.id));
  };

  const deselectAll = () => {
    setSelectedResources([]);
  };

  const deleteSelectedResources = async () => {
    if (!currentUser || selectedResources.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedResources.length} FHIR resources? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    setMessage(`Deleting ${selectedResources.length} resources...`);
    
    try {
      let deleted = 0;
      
      for (const resourceId of selectedResources) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'fhir_resources', resourceId));
          deleted++;
        } catch (err) {
          console.error(`Error deleting resource ${resourceId}:`, err);
        }
      }
      
      setDeletedCount(prev => prev + deleted);
      setMessage(`Successfully deleted ${deleted} FHIR resources.`);
      
      // Remove deleted resources from the list
      setOrphanedResources(prev => prev.filter(r => !selectedResources.includes(r.id)));
      setSelectedResources([]);
      
      // Clear any local storage caches for FHIR resources
      localStorage.removeItem(`fhir_resources_${currentUser.uid}`);
    } catch (error) {
      console.error('Error deleting resources:', error);
      setMessage(`Error deleting resources: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteAllLaboratoryReports = async () => {
    if (!currentUser) return;
    
    if (!confirm('Are you sure you want to delete ALL Laboratory and DiagnosticReport resources? This cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setMessage('Deleting all laboratory-related resources...');
    
    try {
      // Find all Observation resources
      const observationsQuery = query(
        collection(db, 'users', currentUser.uid, 'fhir_resources'),
        where('resourceType', '==', 'Observation')
      );
      const observationsSnapshot = await getDocs(observationsQuery);
      
      // Find all DiagnosticReport resources
      const reportsQuery = query(
        collection(db, 'users', currentUser.uid, 'fhir_resources'),
        where('resourceType', '==', 'DiagnosticReport')
      );
      const reportsSnapshot = await getDocs(reportsQuery);
      
      let deleted = 0;
      
      // Delete observations
      for (const doc of observationsSnapshot.docs) {
        await deleteDoc(doc.ref);
        deleted++;
      }
      
      // Delete reports
      for (const doc of reportsSnapshot.docs) {
        await deleteDoc(doc.ref);
        deleted++;
      }
      
      setDeletedCount(prev => prev + deleted);
      setMessage(`Successfully deleted ${deleted} laboratory-related resources.`);
      
      // Clear any local storage caches for FHIR resources
      localStorage.removeItem(`fhir_resources_${currentUser.uid}`);
      
      // Refresh the list after deletion
      findOrphanedResources();
    } catch (error) {
      console.error('Error deleting laboratory resources:', error);
      setMessage(`Error deleting laboratory resources: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="h-16"></div>
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-primary-blue mb-6">FHIR Resources Cleanup</h1>
          
          <div className="bg-gray-800 rounded-md p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Utility Functions</h2>
              <span className="text-gray-300">{deletedCount} resources deleted this session</span>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <button 
                onClick={findOrphanedResources}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Scan for Orphaned Resources
              </button>
              
              <button 
                onClick={deleteAllLaboratoryReports}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                Delete All Laboratory Resources
              </button>
            </div>
            
            {message && (
              <div className="bg-gray-700 p-3 rounded text-white">
                {message}
              </div>
            )}
          </div>
          
          {orphanedResources.length > 0 && (
            <div className="bg-gray-800 rounded-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Orphaned FHIR Resources</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={selectAll}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={deselectAll}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Deselect All
                  </button>
                  <button 
                    onClick={deleteSelectedResources}
                    disabled={selectedResources.length === 0 || loading}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    Delete Selected ({selectedResources.length})
                  </button>
                </div>
              </div>
              
              <div className="overflow-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-10">
                        Select
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Resource ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {orphanedResources.map((resource) => (
                      <tr key={resource.id}>
                        <td className="py-2 px-3">
                          <input 
                            type="checkbox"
                            checked={selectedResources.includes(resource.id)}
                            onChange={() => toggleResource(resource.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-2 px-3 text-white">
                          {resource.type}
                        </td>
                        <td className="py-2 px-3 text-gray-300 font-mono text-xs">
                          {resource.id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 