'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, onSnapshot, doc, deleteDoc, Firestore, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { FaPlus, FaSearch, FaFilter, FaFileAlt, FaFilePdf, FaFileImage, FaFileMedical, FaExternalLinkAlt, FaTrash, FaChartBar } from 'react-icons/fa';
import { extractRecordDate, extractRecordType } from '../lib/analysis-utils';
import { Observation, DiagnosticReport } from '../types/fhir';
import { ActivityIcon, AlertCircle } from 'lucide-react';

// Add a new interface for cached data
interface CachedObservationData {
  observations: Observation[];
  timestamp: number;
}

// Interface for SimpleRecord
interface SimpleRecord {
  id: string;
  name: string;
  url?: string;
  urls?: string[];
  isMultiFile?: boolean;
  briefSummary?: string;
  detailedAnalysis?: string;
  recordType: string;
  recordDate: string;
  fhirResourceIds?: string[] | Record<string, any>;
  createdAt: any;
  analysisStatus?: 'pending' | 'complete' | 'error';
  analysisInProgress?: boolean;
  analysisError?: string;
}

// Category icons mapping
const categoryIcons: Record<string, JSX.Element> = {
  'lab': <FaFileMedical className="text-blue-400" />,
  'imaging': <FaFileImage className="text-purple-400" />,
  'prescription': <FaFileMedical className="text-green-400" />,
  'report': <FaFilePdf className="text-red-400" />,
  'document': <FaFileAlt className="text-yellow-400" />,
  'default': <FaFileAlt className="text-gray-400" />
};

// A very simple gauge component to guarantee it renders
function SimpleGauge({ value, low, high, unit, name }: { 
  value: number | undefined, 
  low?: number | undefined, 
  high?: number | undefined, 
  unit?: string,
  name?: string
}) {
  // Ensure numeric value
  const numericValue = typeof value === 'number' && !isNaN(value) ? value : 1.7;
  
  // Default ranges if not provided or invalid
  const actualLow = (typeof low === 'number' && !isNaN(low)) ? low : numericValue * 0.7;
  const actualHigh = (typeof high === 'number' && !isNaN(high)) ? high : numericValue * 1.3;
  
  // Calculate the normal range span
  const normalRangeSpan = actualHigh - actualLow;
  
  // Ensure we show values that fall outside the normal range
  // Create a scale that extends 50% of the normal range beyond both sides
  const minScale = actualLow - (normalRangeSpan * 0.5);
  const maxScale = actualHigh + (normalRangeSpan * 0.5);
  
  // Ensure the value is still within the display scale
  // If value is outside our calculated scale, adjust the scale to include it
  const finalMinScale = Math.min(minScale, numericValue);
  const finalMaxScale = Math.max(maxScale, numericValue);
  
  const range = finalMaxScale - finalMinScale;
  
  // Calculate position percentage
  const position = Math.min(100, Math.max(0, ((numericValue - finalMinScale) / range) * 100));
  
  // Calculate position of normal range markers
  const lowPosition = ((actualLow - finalMinScale) / range) * 100;
  const highPosition = ((actualHigh - finalMinScale) / range) * 100;
  
  // Determine if value is in range
  const inRange = numericValue >= actualLow && numericValue <= actualHigh;
  
  return (
    <div className="mb-2 text-sm">
      {/* Gauge container */}
      <div className="h-4 bg-gray-800 rounded-full relative overflow-hidden shadow-inner">
        {/* Normal range background - green area */}
        <div 
          className="absolute top-0 bottom-0 bg-green-500/50"
          style={{ 
            left: `${lowPosition}%`, 
            width: `${highPosition - lowPosition}%` 
          }}
        ></div>
        
        {/* Range markers */}
        <div className="absolute inset-y-0 border-l border-white/60" style={{ left: `${lowPosition}%` }}></div>
        <div className="absolute inset-y-0 border-l border-white/60" style={{ left: `${highPosition}%` }}></div>
        
        {/* Position marker */}
        <div 
          className="absolute top-0 bottom-0 flex items-center" 
          style={{ left: `${position}%` }}
        >
          <div className={`w-3 h-3 rounded-full ${inRange ? 'bg-green-500' : 'bg-yellow-500'} border border-white shadow transform -translate-x-1/2 z-10`}></div>
        </div>
      </div>
      
      {/* Range indicators */}
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <div>{finalMinScale.toFixed(1)}</div>
        <div>{finalMaxScale.toFixed(1)}</div>
      </div>
    </div>
  );
}

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

export default function Records() {
  const [records, setRecords] = useState<SimpleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const { currentUser } = useAuth();
  const [recordObservations, setRecordObservations] = useState<{[recordId: string]: Observation[]}>({});
  const [loadingObservations, setLoadingObservations] = useState<{[recordId: string]: boolean}>({});
  const [viewDetailedAnalysis, setViewDetailedAnalysis] = useState<string[]>([]);
  const [viewFhirText, setViewFhirText] = useState<string[]>([]);
  const [viewFhirResources, setViewFhirResources] = useState<string[]>([]);

  // Cache keys and expiry
  const OBSERVATIONS_CACHE_KEY = 'health_observations_cache_';
  const EXPANDED_RECORDS_KEY = 'health_expanded_records';
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Load cached observations on component mount
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;
    
    // Load expanded records state from localStorage
    const loadExpandedState = () => {
      try {
        const savedExpandedRecords = localStorage.getItem(EXPANDED_RECORDS_KEY);
        if (savedExpandedRecords) {
          const parsed = JSON.parse(savedExpandedRecords);
          if (Array.isArray(parsed)) {
            setExpandedRecords(parsed);
          }
        }
      } catch (e) {
        console.error("Error loading expanded records state:", e);
      }
    };
    
    // Load cached observations data
    const loadCachedObservations = () => {
      const cacheKey = `${OBSERVATIONS_CACHE_KEY}${currentUser.uid}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const { observations, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          
          // Check if cache is still valid
          if (now - timestamp < CACHE_EXPIRY && typeof observations === 'object') {
            console.log("Loading observations from cache");
            setRecordObservations(observations);
            
            // Pre-load observations for expanded records
            const expandedIds = localStorage.getItem(EXPANDED_RECORDS_KEY);
            if (expandedIds) {
              try {
                const expandedArray = JSON.parse(expandedIds);
                setExpandedRecords(expandedArray);
              } catch (e) {
                console.error("Error parsing expanded records:", e);
              }
            }
          } else {
            // Remove expired cache
            localStorage.removeItem(cacheKey);
          }
        } catch (e) {
          console.error("Error parsing cached observations:", e);
          localStorage.removeItem(cacheKey);
        }
      }
    };
    
    loadExpandedState();
    loadCachedObservations();
  }, [currentUser]);
  
  // Save expanded records state when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(EXPANDED_RECORDS_KEY, JSON.stringify(expandedRecords));
    } catch (e) {
      console.error("Error saving expanded records state:", e);
    }
  }, [expandedRecords]);
  
  // Save observations to cache when they change
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser || Object.keys(recordObservations).length === 0) return;
    
    try {
      const cacheKey = `${OBSERVATIONS_CACHE_KEY}${currentUser.uid}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        observations: recordObservations,
        timestamp: Date.now()
      }));
      console.log("Saved observations to cache");
    } catch (e) {
      console.error("Error caching observations:", e);
    }
  }, [recordObservations, currentUser]);

  // Format date to year
  const getRecordYear = (dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    
    // Try to parse the date string
    const date = new Date(dateStr);
    
    // Check if the date is valid
    if (!isNaN(date.getTime())) {
      return date.getFullYear();
    }
    
    // Try to extract year using regex
    const yearRegex = /\b(20\d{2})\b/;
    const match = dateStr.match(yearRegex);
    if (match) {
      return parseInt(match[0]);
    }
    
    return 0;
  };

  // Load records when component mounts
  useEffect(() => {
    if (!currentUser) return;
    
    setLoading(true);
    
    // Reference to the user's records collection
    const recordsRef = collection(db as Firestore, 'users', currentUser.uid, 'records');
    
    // Create a query to order by createdAt (newest first)
    const recordsQuery = query(recordsRef, orderBy('createdAt', 'desc'));
    
    // Set up the snapshot listener
    const unsubscribe = onSnapshot(recordsQuery, 
      (snapshot) => {        
        const recordsList = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Determine analysis status based on available data
          let analysisStatus: 'pending' | 'complete' | 'error' = 'complete';
          
          // Check if analysis is explicitly marked as in progress
          if (data.analysisInProgress === true) {
            analysisStatus = 'pending';
          } 
          // If not explicitly marked and created recently, check if briefSummary exists
          else if (data.analysisInProgress === undefined) {
            // If no briefSummary and record was created recently (within last 5 minutes), consider analysis pending
            if (!data.briefSummary) {
              const createdTime = data.createdAt?.seconds 
                ? new Date(data.createdAt.seconds * 1000)
                : null;
                
              if (createdTime && ((Date.now() - createdTime.getTime()) < 5 * 60 * 1000)) {
                analysisStatus = 'pending';
              }
            }
          }
          
          // If there's an explicit analysis error message, mark as error
          if (data.analysisError || (data.analysis && typeof data.analysis === 'string' && data.analysis.includes('Error'))) {
            analysisStatus = 'error';
          }
          
          return {
            id: doc.id,
            name: data.name || 'Unnamed Record',
            recordType: data.recordType,
            recordDate: data.recordDate || new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0],
            url: data.url,
            urls: data.urls,
            isMultiFile: data.isMultiFile,
            briefSummary: data.briefSummary,
            detailedAnalysis: data.detailedAnalysis,
            fhirResourceIds: data.fhirResourceIds,
            createdAt: data.createdAt,
            analysisStatus: analysisStatus,
            analysisInProgress: data.analysisInProgress,
            analysisError: data.analysisError
          } as SimpleRecord;
        });
        
        setRecords(recordsList);
        setLoading(false);
      },
      (error) => {
        setError("Error loading records. Please try again.");
        setLoading(false);
      }
    );
    
    // Clean up the listener when component unmounts
    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Additional effect for iOS standalone mode scrolling fix
  useEffect(() => {
    // Check if we're in iOS standalone mode
    const isIOSStandalone = 
      typeof window !== 'undefined' && 
      (
        (window.navigator as any).standalone === true || 
        window.matchMedia('(display-mode: standalone)').matches
      );
    
    if (isIOSStandalone) {
      console.log('Applying standalone scrolling fixes for iOS');
      
      // Fix scrolling containers after a short delay to ensure DOM is ready
      const fixScrollingContainers = () => {
        // Get the main scrollable container for records page
        const scrollContainer = document.querySelector('.fixed.top-16.bottom-16 > div');
        if (scrollContainer) {
          // Force scrolling properties
          (scrollContainer as HTMLElement).style.overflowY = 'auto';
          // Use setAttribute for non-standard properties
          (scrollContainer as HTMLElement).setAttribute('style', 
            `overflow-y: auto !important; 
             -webkit-overflow-scrolling: touch !important; 
             touch-action: pan-y !important;`
          );
          
          // Ensure it doesn't stop responding to touch events
          scrollContainer.addEventListener('touchstart', () => {}, { passive: true });
        }
      };
      
      // Apply fix after component mounts
      setTimeout(fixScrollingContainers, 300);
      
      // Re-apply on orientation change
      window.addEventListener('orientationchange', () => {
        setTimeout(fixScrollingContainers, 300);
      });
      
      return () => {
        window.removeEventListener('orientationchange', () => {
          setTimeout(fixScrollingContainers, 300);
        });
      };
    }
  }, []);

  // Filter and group records
  const filteredAndGroupedRecords = useMemo(() => {
    // Debug each record before processing
    console.log('All records before filtering:', records.map(r => ({
      id: r.id, 
      recordType: r.recordType,
      hasDetailedAnalysis: !!r.briefSummary
    })));
    
    // Apply filters first
    let filtered = records;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.recordType?.toLowerCase().includes(search) ||
        record.briefSummary?.toLowerCase().includes(search)
      );
    }
    
    if (filterType) {
      filtered = filtered.filter(record => 
        record.recordType?.toLowerCase().includes(filterType.toLowerCase())
      );
    }
    
    // Group by year
    const grouped: { [year: number]: SimpleRecord[] } = {};
    
    filtered.forEach(record => {
      const year = getRecordYear(record.recordDate);
      if (!year) return; // Skip records without a year
      
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(record);
    });
    
    // Sort years in descending order
    return Object.entries(grouped)
      .map(([year, records]) => ({
        year: parseInt(year),
        records
      }))
      .sort((a, b) => b.year - a.year);
  }, [records, searchTerm, filterType]);

  const getCategoryIcon = (record: SimpleRecord) => {
    if (!record.recordType) return categoryIcons.default;
    
    const type = record.recordType.toLowerCase();
    
    if (type.includes('lab') || type.includes('test')) {
      return categoryIcons.lab;
    } else if (type.includes('image') || type.includes('scan') || type.includes('xray') || type.includes('mri') || type.includes('ct')) {
      return categoryIcons.imaging;
    } else if (type.includes('prescription') || type.includes('medication')) {
      return categoryIcons.prescription;
    } else if (type.includes('report') || type.includes('discharge') || type.includes('summary')) {
      return categoryIcons.report;
    } else {
      return categoryIcons.document;
    }
  };

  // Fetch observations for a record
  const fetchObservationsForRecord = useCallback(async (record: SimpleRecord) => {
    console.log(`Fetching observations for record ${record.id}, record type: ${record.recordType}`);
    console.log('FHIR Resource IDs:', JSON.stringify(record.fhirResourceIds));
    
    if (!currentUser || !record.fhirResourceIds) {
      console.log(`No FHIR resources to fetch for record ${record.id}`);
      return;
    }
    
    // Check if we already have observations for this record in state
    if (recordObservations[record.id]?.length > 0) {
      console.log(`Using cached observations for record ${record.id}`);
      return;
    }
    
    // Track loading state for this record
    setLoadingObservations(prev => ({ ...prev, [record.id]: true }));
    
    try {
      const observations: Observation[] = [];
      
      // Get resource IDs, handling both array and object formats
      let resourceIds: string[] = [];
      
      if (Array.isArray(record.fhirResourceIds)) {
        // If fhirResourceIds is already an array
        resourceIds = record.fhirResourceIds.filter(id => id);
        console.log('Resource IDs from array:', resourceIds);
      } else if (typeof record.fhirResourceIds === 'object' && record.fhirResourceIds !== null) {
        // If fhirResourceIds is an object (from older uploads)
        const resourceObj = record.fhirResourceIds as any;
        console.log('Resource IDs object:', resourceObj);
        
        // Special handling for direct Observation property - this is likely the format for new records
        if (resourceObj.Observation && Array.isArray(resourceObj.Observation)) {
          console.log('Found direct Observation array in resourceIds object');
          resourceIds = resourceObj.Observation.filter((id: string) => id);
        } else {
          // Extract all string values and arrays from the object
          const extractedIds: string[] = [];
          Object.entries(resourceObj).forEach(([key, value]) => {
            console.log(`Processing key "${key}" with value:`, value);
            if (typeof value === 'string' && value) {
              extractedIds.push(value);
            } else if (Array.isArray(value)) {
              extractedIds.push(...value.filter(id => id));
            }
          });
          
          resourceIds = extractedIds;
        }
        
        console.log('Extracted resource IDs:', resourceIds);
      }
      
      if (resourceIds.length === 0) {
        console.log(`No valid resource IDs found for record ${record.id}`);
        return;
      }
      
      // Process reference-style IDs (eg. "Observation/observation-FullBloodExamination")
      const processedIds: string[] = [];
      for (const id of resourceIds) {
        if (id.includes('/')) {
          // This is a reference-style ID like "Observation/observation-FullBloodExamination"
          const parts = id.split('/');
          if (parts.length === 2) {
            processedIds.push(parts[1]); // Just take the actual ID part
            console.log(`Converted reference-style ID "${id}" to "${parts[1]}"`);
          } else {
            processedIds.push(id);
          }
        } else {
          processedIds.push(id);
        }
      }
      
      // Fetch each potential FHIR resource
      for (const resourceId of processedIds) {
        console.log(`Attempting to fetch FHIR resource with ID: ${resourceId}`);
        
        // Try multiple paths to find the resource
        const paths = [
          // Try format: users/{uid}/fhir_resources/Observation_{id}
          doc(db as Firestore, 'users', currentUser.uid, 'fhir_resources', `Observation_${resourceId}`),
          // Try format: users/{uid}/fhir_resources/{id} (if already includes resourceType)
          doc(db as Firestore, 'users', currentUser.uid, 'fhir_resources', resourceId),
          // Try format: users/{uid}/fhir/{id} (legacy)
          doc(db as Firestore, 'users', currentUser.uid, 'fhir', resourceId)
        ];
        
        let resourceDoc = null;
        let foundPath = '';
        
        // Try each path until we find the resource
        for (let i = 0; i < paths.length; i++) {
          const docRef = paths[i];
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            resourceDoc = docSnap;
            foundPath = ['fhir_resources/Observation_', 'fhir_resources/', 'fhir/'][i] + resourceId;
            console.log(`Found resource at path: ${foundPath}`);
            break;
          }
        }
        
        if (resourceDoc && resourceDoc.exists()) {
          const data = resourceDoc.data();
          
          // Check if it's an Observation
          if (data.resourceType === 'Observation') {
            console.log(`Found Observation: ${resourceDoc.id}`);
            
            // Check if this is a panel/group observation with components (like FBE/CBC)
            if (data.component && Array.isArray(data.component) && data.component.length > 0) {
              console.log(`This observation has ${data.component.length} components - creating individual observations`);
              
              // Extract each component as a separate observation
              data.component.forEach((component: any, index: number) => {
                if (component.code && (component.valueQuantity || component.valueString)) {
                  const componentId = `${resourceId}-component-${index}`;
                  
                  // Create a new observation from this component
                  const componentObs: Observation = {
                    resourceType: 'Observation',
                    id: componentId,
                    status: data.status || 'final',
                    code: component.code,
                    valueQuantity: component.valueQuantity,
                    valueString: component.valueString,
                    subject: data.subject,
                    effectiveDateTime: data.effectiveDateTime,
                    issued: data.issued,
                    referenceRange: component.referenceRange || []
                  };
                  
                  observations.push(componentObs);
                  console.log(`Created component observation: ${componentId} - ${component.code?.text || 'unnamed'}`);
                }
              });
            } else {
              // Regular single observation
              // Ensure we have an ID property that matches the document ID
              const observationWithId = {
                ...data,
                id: resourceDoc.id.includes('_') 
                  ? resourceDoc.id.split('_')[1] 
                  : resourceDoc.id
              };
              observations.push(observationWithId as Observation);
            }
          } else {
            console.log(`Resource is not an Observation: ${data.resourceType}`);
          }
        } else {
          console.log(`No resource found for ID: ${resourceId}`);
        }
      }
      
      console.log(`Found ${observations.length} observations for record ${record.id}`);
      
      // For debugging: if no observations found but we were expecting some, try checking both collections
      if (observations.length === 0 && processedIds.length > 0) {
        console.log('No observations found but IDs were present. Checking both FHIR collections...');
        
        // Try listing all resources to see what's available
        try {
          const fhirResourcesRef = collection(db as Firestore, 'users', currentUser.uid, 'fhir_resources');
          const fhirResourceDocs = await getDocs(fhirResourcesRef);
          console.log(`Found ${fhirResourceDocs.size} documents in fhir_resources collection`);
          fhirResourceDocs.forEach(doc => {
            console.log(`Document ID: ${doc.id}, ResourceType: ${doc.data().resourceType}`);
          });
          
          // Check legacy collection too
          const fhirRef = collection(db as Firestore, 'users', currentUser.uid, 'fhir');
          const fhirDocs = await getDocs(fhirRef);
          console.log(`Found ${fhirDocs.size} documents in fhir collection`);
          fhirDocs.forEach(doc => {
            console.log(`Document ID: ${doc.id}, ResourceType: ${doc.data().resourceType}`);
          });
        } catch (e) {
          console.error('Error listing available FHIR resources:', e);
        }
      }
      
      // Create mock observations from parsed lab data if no observations were found
      if (observations.length === 0 && record.briefSummary) {
        console.log('No observations found in FHIR resources, attempting to extract from summary text');
        
        // Try to parse the lab results from the summary text
        const labRegex = /([A-Za-z]+):\s*([\d.]+)\s*([^\s()]+)?\s*\(([^)]+)\)/g;
        const briefSummary = record.briefSummary;
        let match;
        let index = 0;
        
        while ((match = labRegex.exec(briefSummary)) !== null) {
          const [_, name, value, unit, range] = match;
          const numValue = parseFloat(value);
          
          if (!isNaN(numValue)) {
            // Parse the reference range
            const rangeMatch = range.match(/([\d.]+)-([\d.]+)/);
            const refRange = rangeMatch ? {
              low: { value: parseFloat(rangeMatch[1]) },
              high: { value: parseFloat(rangeMatch[2]) }
            } : undefined;
            
            // Create a mock observation
            const mockObs: Observation = {
              resourceType: 'Observation',
              id: `parsed-${record.id}-${index}`,
              status: 'final',
              code: {
                text: name
              },
              valueQuantity: {
                value: numValue,
                unit: unit || ''
              },
              referenceRange: refRange ? [refRange] : []
            };
            
            observations.push(mockObs);
            console.log(`Created mock observation from text: ${name}: ${value} ${unit}`);
            index++;
          }
        }
      }
      
      // Update state with observations for this record
      setRecordObservations(prev => ({
        ...prev,
        [record.id]: observations
      }));
      
    } catch (error) {
      console.error("Error fetching observations:", error);
    } finally {
      setLoadingObservations(prev => ({ ...prev, [record.id]: false }));
    }
  }, [currentUser, recordObservations]);

  // Check if a record has FHIR resources
  const hasFhirResources = useCallback((record: SimpleRecord): boolean => {
    if (!record.fhirResourceIds) return false;
    
    if (Array.isArray(record.fhirResourceIds)) {
      return record.fhirResourceIds.length > 0;
    }
    
    if (typeof record.fhirResourceIds === 'object' && record.fhirResourceIds !== null) {
      return Object.keys(record.fhirResourceIds).length > 0;
    }
    
    return false;
  }, []);

  // Toggle record expansion and fetch observations if needed
  const toggleRecordExpansion = useCallback((recordId: string) => {
    const isExpanding = !expandedRecords.includes(recordId);
    
    // Toggle expanded state
    setExpandedRecords(prev => 
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
    
    // If expanding and record has FHIR resources, fetch the observations
    if (isExpanding) {
      const record = records.find(r => r.id === recordId);
      if (record && hasFhirResources(record)) {
        fetchObservationsForRecord(record);
      }
    }
  }, [expandedRecords, records, hasFhirResources, fetchObservationsForRecord]);

  // Format date to more readable format
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'Unknown date';
    
    // Try to parse the date string
    const date = new Date(dateStr);
    
    // Check if the date is valid
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      });
    }
    
    return dateStr;
  };

  const deleteRecord = useCallback(async (recordId: string) => {
    if (!currentUser) return;
    
    try {
      const recordsRef = collection(db as Firestore, 'users', currentUser.uid, 'records');
      const recordDoc = doc(recordsRef, recordId);
      await deleteDoc(recordDoc);
      
      // Remove from records state
      setRecords(prevRecords => prevRecords.filter(record => record.id !== recordId));
      
      // Remove from expanded records
      setExpandedRecords(prev => prev.filter(id => id !== recordId));
      
      // Remove from observations
      setRecordObservations(prev => {
        const newObservations = { ...prev };
        delete newObservations[recordId];
        return newObservations;
      });
      
    } catch (error) {
      console.error("Error deleting record:", error);
      setError("Error deleting record. Please try again.");
    }
  }, [currentUser]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Navigation />
        
        {/* Main content - Structure specially for iOS scrolling */}
        <div className="fixed top-16 bottom-16 left-0 right-0 overflow-hidden records-scroll-container">
          <div className="h-full w-full overflow-y-scroll touch-pan-y -webkit-overflow-scrolling-touch records-scroll-wrapper">
            <div className="px-2 py-6 pb-24 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-primary-blue">My Records</h1>
                <Link 
                  href="/upload" 
                  className="text-blue-400 hover:text-blue-300 flex items-center"
                >
                  <FaPlus className="mr-2" /> Upload
                </Link>
              </div>
              
              {/* Search and filter */}
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative md:w-48">
                  <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 appearance-none text-white"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="">All types</option>
                    <option value="lab">Lab Results</option>
                    <option value="imaging">Imaging</option>
                    <option value="prescription">Prescriptions</option>
                    <option value="report">Reports</option>
                    <option value="document">Documents</option>
                  </select>
                </div>
              </div>
              
              {/* Loading state */}
              {loading && (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              )}
              
              {/* Error state */}
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                  <p className="text-red-400">{error}</p>
                </div>
              )}
              
              {/* Empty state */}
              {!loading && filteredAndGroupedRecords.length === 0 && (
                <div className="text-center py-12">
                  <FaFileAlt className="mx-auto text-gray-600 text-5xl mb-4" />
                  <h3 className="text-xl font-medium text-gray-400 mb-2">No records found</h3>
                  {searchTerm || filterType ? (
                    <p className="text-gray-500">Try adjusting your search or filters</p>
                  ) : (
                    <div>
                      <p className="text-gray-500 mb-4">Upload your first medical record to get started</p>
                      <Link 
                        href="/upload" 
                        className="text-blue-400 hover:text-blue-300 inline-flex items-center"
                      >
                        <FaPlus className="mr-2" /> Upload Record
                      </Link>
                    </div>
                  )}
                </div>
              )}
              
              {/* Records by year */}
              {!loading && filteredAndGroupedRecords.map(({ year, records }) => (
                <div key={year} className="mb-8">
                  <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-4">{year}</h2>
                  
                  <ul className="space-y-2">
                    {records.map(record => (
                      <li key={record.id} className="bg-gray-900/30 rounded-lg p-4 transition-all duration-200 hover:bg-gray-900/50">
                        <div 
                          className="flex items-start justify-between cursor-pointer"
                          onClick={() => toggleRecordExpansion(record.id)}
                        >
                          <div className="flex items-start">
                            <div className="text-xl mr-3 mt-1">
                              {getCategoryIcon(record)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white truncate max-w-[240px] sm:max-w-none flex items-center gap-2">
                                {record.recordType || 'Unknown Record'}
                                <span className="text-sm text-gray-400 ml-2">
                                  {new Date(record.recordDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </span>
                                {record.analysisStatus === 'pending' && (
                                  <div className="inline-flex items-center relative group">
                                    <span className="animate-spin h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent rounded-full mr-1.5"></span>
                                    <span className="text-xs text-blue-400">Analyzing</span>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute left-0 -top-8 transform scale-0 transition-transform group-hover:scale-100 origin-bottom">
                                      <div className="bg-blue-900 text-white p-2 rounded-md shadow-lg text-xs whitespace-nowrap">
                                        Your record is being analyzed
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {record.analysisStatus === 'error' && (
                                  <div className="inline-flex items-center text-red-400 relative group">
                                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                    <span className="text-xs">Analysis error</span>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute left-0 -top-8 transform scale-0 transition-transform group-hover:scale-100 origin-bottom">
                                      <div className="bg-red-900 text-white p-2 rounded-md shadow-lg text-xs whitespace-nowrap">
                                        There was a problem analyzing this record
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 flex flex-wrap items-center gap-1 sm:gap-2">
                                {/* Date moved to be on the same line as the record type */}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400 p-1 ml-2">
                            <svg 
                              className={`w-4 h-4 transform transition-transform ${expandedRecords.includes(record.id) ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24" 
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        
                        {expandedRecords.includes(record.id) && (
                          <div className="mt-4 pt-3 border-t border-gray-700 transition-all">
                            {/* Debug section to help troubleshoot */}
                            <div className="text-xs text-gray-500 mb-2">
                              Record ID: {record.id} | 
                              Type: {record.recordType} | 
                              Analysis: {record.analysisInProgress ? 'In Progress' : 'Complete'} |
                              FHIR Resources: {record.fhirResourceIds ? 
                                (Array.isArray(record.fhirResourceIds) 
                                  ? record.fhirResourceIds.length 
                                  : Object.keys(record.fhirResourceIds).length) 
                                : 0}
                            </div>
                            
                            {record.analysisStatus === 'pending' && (
                              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 rounded-md flex items-center text-sm text-white">
                                <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full mr-3"></div>
                                <p>
                                  We're analyzing your medical record to extract lab results and measurements. 
                                  This usually takes less than a minute.
                                </p>
                              </div>
                            )}
                            
                            {record.analysisStatus === 'error' && (
                              <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md flex items-start text-sm text-white">
                                <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium mb-1">There was a problem analyzing this record</p>
                                  <p className="text-gray-300">
                                    {record.analysisError || "An unexpected error occurred during analysis. You can still view the original file."}
                                  </p>
                                  {record.analysisError && record.analysisError.includes("Expected ',' or '}' after property value in JSON") && (
                                    <div className="mt-2 p-2 bg-gray-900 rounded-md text-xs font-mono overflow-x-auto">
                                      <p className="text-red-400 mb-1">JSON syntax error in FHIR resource:</p>
                                      {typeof window !== 'undefined' && (window as any).lastFHIRParseError && (window as any).lastFHIRParseError.context ? (
                                        <code className="whitespace-pre-wrap text-xs">
                                          {(window as any).lastFHIRParseError.context}
                                        </code>
                                      ) : (
                                        <p className="text-gray-400">
                                          Try refreshing the page or re-uploading the document to see the detailed error.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {record.briefSummary && (
                              <div className="text-sm mb-4 text-gray-300">
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="font-medium text-white">
                                    {viewDetailedAnalysis.includes(record.id) ? 'Detailed Analysis' : 'Summary'}
                                  </h4>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewDetailedAnalysis(prev => 
                                        prev.includes(record.id) 
                                          ? prev.filter(id => id !== record.id)
                                          : [...prev, record.id]
                                      );
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    {viewDetailedAnalysis.includes(record.id) ? 'View Summary' : 'View Detailed Analysis'}
                                  </button>
                                </div>
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {viewDetailedAnalysis.includes(record.id) 
                                    ? (record.detailedAnalysis || record.briefSummary)
                                    : record.briefSummary}
                                </p>
                              </div>
                            )}
                            
                            {/* Add FHIR Text section */}
                            {record.fhirResourceIds && (
                              <div className="text-sm mb-4 text-gray-300">
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="font-medium text-white">FHIR Resources</h4>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewFhirText(prev => 
                                          prev.includes(record.id) 
                                            ? prev.filter(id => id !== record.id)
                                            : [...prev, record.id]
                                        );
                                      }}
                                      className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                      {viewFhirText.includes(record.id) ? 'Hide FHIR Text' : 'View FHIR Text'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewFhirResources(prev => 
                                          prev.includes(record.id) 
                                            ? prev.filter(id => id !== record.id)
                                            : [...prev, record.id]
                                        );
                                      }}
                                      className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                      {viewFhirResources.includes(record.id) ? 'Hide Resource List' : 'View Resource List'}
                                    </button>
                                  </div>
                                </div>
                                
                                {/* FHIR Text View */}
                                {viewFhirText.includes(record.id) && recordObservations[record.id] && (
                                  <div className="mt-2 bg-gray-900 rounded-md p-3 overflow-auto max-h-96">
                                    <pre className="text-xs text-gray-300">
                                      {JSON.stringify(recordObservations[record.id], null, 2)}
                                    </pre>
                                  </div>
                                )}
                                
                                {/* FHIR Resources List View */}
                                {viewFhirResources.includes(record.id) && (
                                  <div className="mt-2">
                                    <h5 className="text-sm font-medium text-gray-400 mb-2">Extracted FHIR Resources:</h5>
                                    <ul className="list-disc list-inside space-y-1">
                                      {Array.isArray(record.fhirResourceIds) ? (
                                        record.fhirResourceIds.map((resourceId, index) => (
                                          <li key={index} className="text-xs text-gray-400">
                                            {resourceId}
                                          </li>
                                        ))
                                      ) : (
                                        Object.entries(record.fhirResourceIds || {}).map(([type, ids], index) => (
                                          <li key={index} className="text-xs text-gray-400">
                                            {type}: {Array.isArray(ids) ? ids.length : 1} resource(s)
                                          </li>
                                        ))
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* FHIR Observations Section */}
                            {record.fhirResourceIds && (
                              Array.isArray(record.fhirResourceIds) 
                                ? record.fhirResourceIds.length > 0
                                : typeof record.fhirResourceIds === 'object' && Object.keys(record.fhirResourceIds).length > 0
                            ) ? (
                              <div className="my-4">
                                {loadingObservations[record.id] ? (
                                  <>
                                    <h4 className="font-medium text-white mb-2">Lab Results & Measurements:</h4>
                                    <div className="flex justify-center items-center h-12">
                                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                                    </div>
                                  </>
                                ) : recordObservations[record.id]?.length > 0 ? (
                                  <>
                                    <h4 className="font-medium text-white mb-2">Lab Results & Measurements:</h4>
                                    <ul className="space-y-2">
                                      {recordObservations[record.id].map(observation => {
                                        // Extract observation details
                                        const name = getFormattedTestName(observation);
                                        const value = observation.valueQuantity?.value !== undefined 
                                          ? `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`
                                          : observation.valueString || 'No value';
                                        
                                        // Check if abnormal
                                        const isAbnormal = observation.interpretation && 
                                          observation.interpretation.some(i => 
                                            i.coding && i.coding.some(c => ['H', 'L', 'HH', 'LL', 'A'].includes(c.code || ''))
                                          );
                                        
                                        return (
                                          <li 
                                            key={observation.id} 
                                            className="px-3 py-2 bg-gray-800/50 rounded-md cursor-pointer hover:bg-gray-800/80 transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.location.href = `/observation/${observation.id}`;
                                            }}
                                          >
                                            <div className="flex justify-between items-start">
                                              <div>
                                                <div className="flex items-center">
                                                  <span className="text-sm font-medium text-white">{name}</span>
                                                  {isAbnormal && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-900/50 text-red-300">
                                                      Abnormal
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className={`text-sm font-medium ${isAbnormal ? 'text-red-300' : 'text-gray-200'}`}>
                                                {value}
                                              </div>
                                            </div>
                                            
                                            {/* Visualization Section */}
                                            {typeof observation.valueQuantity?.value === 'number' && observation.id !== undefined && (
                                              <div className="mt-3">
                                                {/* Directly embed the gauge here */}
                                                <SimpleGauge 
                                                  value={observation.valueQuantity?.value ?? 1.7} 
                                                  low={observation.referenceRange?.[0]?.low?.value}
                                                  high={observation.referenceRange?.[0]?.high?.value}
                                                  unit={observation.valueQuantity?.unit || ''}
                                                  name={name}
                                                />
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-400">No lab results found for this record.</p>
                                )}
                              </div>
                            ) : null}
                            
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mt-3">
                              <div className="space-y-2 sm:space-y-0 sm:space-x-2 flex flex-col sm:flex-row">
                                {record.url && !record.isMultiFile && (
                                  <a 
                                    href={record.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FaExternalLinkAlt className="mr-2" size={12} />
                                    View File
                                  </a>
                                )}
                                
                                {record.isMultiFile && record.urls && record.urls.length > 0 && (
                                  <div className="mt-2 sm:mt-0">
                                    <div className="text-xs text-gray-400 mb-1">
                                      {record.urls.length} files available:
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {record.urls.map((url, index) => (
                                        <a
                                          key={`${record.id}-file-${index}`}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 mr-3"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <FaExternalLinkAlt className="mr-1" size={10} />
                                          File {index + 1}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Are you sure you want to delete this record?')) {
                                    deleteRecord(record.id);
                                  }
                                }}
                                className="inline-flex items-center text-sm text-red-500 hover:text-red-400 cursor-pointer"
                              >
                                <FaTrash className="mr-2" size={12} />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 