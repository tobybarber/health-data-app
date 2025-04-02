'use client';

import { useState, useEffect, useRef, MouseEvent } from 'react';
import { useAuth } from '../lib/AuthContext';
import PageLayout from '../components/PageLayout';
import { DeviceInfo, getConnectedDevices } from '../lib/wearable-service';
import { FaHeartbeat, FaSync, FaExclamationCircle, FaFileAlt, FaFilePdf, FaFileImage, FaFileMedical, FaPlus, FaComments, FaRunning, FaBed, FaWeight } from 'react-icons/fa';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';

interface Record {
  id: string;
  name: string;
  recordType?: string;
  recordDate?: string;
  url?: string;
  analysis?: string;
}

// Sample chats for demonstration
const sampleChats = [
  { id: 'new', title: 'New Chat', preview: 'Start a new conversation' },
  { id: '1', title: 'Blood Test Results', preview: 'Analysis of recent blood work...' },
  { id: '2', title: 'Health Goals', preview: 'Discussion about fitness targets...' },
  { id: '3', title: 'Medication Review', preview: 'Questions about current prescriptions...' },
];

// Sample metrics for demonstration
const sampleMetrics = [
  { 
    id: '1', 
    title: 'Daily Steps', 
    value: '8,547', 
    target: '10,000',
    trend: '+12%',
    icon: <FaRunning className="w-5 h-5" />,
    color: 'from-green-500/20 to-green-600/20 text-green-400'
  },
  { 
    id: '2', 
    title: 'Sleep', 
    value: '7h 23m', 
    target: '8h 00m',
    trend: '-45m',
    icon: <FaBed className="w-5 h-5" />,
    color: 'from-blue-500/20 to-blue-600/20 text-blue-400'
  },
  { 
    id: '3', 
    title: 'Heart Rate', 
    value: '72', 
    unit: 'bpm',
    trend: 'Normal',
    icon: <FaHeartbeat className="w-5 h-5" />,
    color: 'from-red-500/20 to-red-600/20 text-red-400'
  },
  { 
    id: '4', 
    title: 'Weight', 
    value: '73.5', 
    unit: 'kg',
    trend: '-0.5kg',
    icon: <FaWeight className="w-5 h-5" />,
    color: 'from-purple-500/20 to-purple-600/20 text-purple-400'
  }
];

// Custom hook for drag to scroll
function useDragToScroll() {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  return {
    ref: containerRef,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseUp,
    style: { cursor: isDragging ? 'grabbing' : 'grab' }
  };
}

export default function TestHomePage() {
  const { currentUser } = useAuth();
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const healthRecordsScroll = useDragToScroll();
  const devicesScroll = useDragToScroll();
  const chatsScroll = useDragToScroll();
  const metricsScroll = useDragToScroll();

  // Load devices
  useEffect(() => {
    async function loadDevices() {
      if (!currentUser) return;
      try {
        const devices = await getConnectedDevices(currentUser.uid);
        setConnectedDevices(devices);
      } catch (error) {
        console.error('Error loading devices:', error);
      } finally {
        setIsLoadingDevices(false);
      }
    }
    
    loadDevices();
  }, [currentUser]);

  // Load records
  useEffect(() => {
    async function loadRecords() {
      if (!currentUser) return;
      try {
        const recordsQuery = query(
          collection(db, `users/${currentUser.uid}/records`),
          orderBy('recordDate', 'desc')
        );
        const snapshot = await getDocs(recordsQuery);
        const recordsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Record[];
        setRecords(recordsData);
      } catch (error) {
        console.error('Error loading records:', error);
      } finally {
        setIsLoadingRecords(false);
      }
    }

    loadRecords();
  }, [currentUser]);

  // Function to format the last sync time
  const formatLastSync = (lastSync?: Date) => {
    if (!lastSync) return 'Never';
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return lastSync.toLocaleDateString();
  };

  // Function to get device status color
  const getStatusColor = (device: DeviceInfo) => {
    if (!device.lastSync) return 'text-gray-400';
    const now = new Date().getTime();
    const hoursSinceSync = (now - device.lastSync.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync < 1) return 'text-green-400';
    if (hoursSinceSync < 24) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Function to get record icon and color based on type
  const getRecordTypeStyles = (recordType?: string) => {
    switch (recordType?.toLowerCase()) {
      case 'pdf':
        return {
          icon: <FaFilePdf className="w-5 h-5" />,
          color: 'from-red-500/20 to-red-600/20 text-red-400'
        };
      case 'image':
        return {
          icon: <FaFileImage className="w-5 h-5" />,
          color: 'from-blue-500/20 to-blue-600/20 text-blue-400'
        };
      case 'medical':
        return {
          icon: <FaFileMedical className="w-5 h-5" />,
          color: 'from-green-500/20 to-green-600/20 text-green-400'
        };
      default:
        return {
          icon: <FaFileAlt className="w-5 h-5" />,
          color: 'from-purple-500/20 to-purple-600/20 text-purple-400'
        };
    }
  };

  // Function to format record date as MMM YYYY
  const formatRecordDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <PageLayout isHomePage={true}>
      <div className="relative z-0">
        <div className="space-y-8">
          {/* Health Records Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Health Records</h2>
              <Link href="/records" className="text-primary-blue hover:text-blue-400 transition-colors">
                See All
              </Link>
            </div>
            
            <div className="relative">
              <div 
                {...healthRecordsScroll}
                className="overflow-x-auto pb-4 -mx-4 px-4 hide-scrollbar select-none"
              >
                <div className="flex space-x-4">
                  {isLoadingRecords ? (
                    // Loading skeleton
                    Array(3).fill(0).map((_, i) => (
                      <div 
                        key={i}
                        className="flex-shrink-0 w-72 h-32 bg-gray-800/50 rounded-xl animate-pulse"
                      />
                    ))
                  ) : records.length > 0 ? (
                    // Record cards
                    records.map((record) => {
                      const { icon, color } = getRecordTypeStyles(record.recordType);
                      return (
                        <Link
                          key={record.id}
                          href={`/records/${record.id}`}
                          className={`flex-shrink-0 w-72 bg-gradient-to-br ${color} backdrop-blur-sm rounded-xl p-4 border border-gray-800/50 hover:bg-gray-800/10 transition-all cursor-pointer`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="p-2 rounded-full bg-gray-900/30">
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white truncate">
                                {record.recordType || 'Document'}
                              </h3>
                              <p className="text-sm text-gray-300">
                                {formatRecordDate(record.recordDate)}
                              </p>
                              {record.name && (
                                <p className="mt-2 text-sm text-gray-300 line-clamp-2">
                                  {record.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    // No records message
                    <div className="flex-shrink-0 w-full bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <FaFileAlt className="w-8 h-8 text-gray-400" />
                        <p className="text-gray-400">No health records found</p>
                        <Link href="/upload" className="text-primary-blue hover:text-blue-400 transition-colors mt-2">
                          Upload Records
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Fade effect for scroll indication */}
              {records.length > 2 && (
                <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
              )}
            </div>
          </section>

          {/* Devices Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Devices</h2>
              <Link href="/wearables" className="text-primary-blue hover:text-blue-400 transition-colors">
                See All
              </Link>
            </div>
            
            <div className="relative">
              <div 
                {...devicesScroll}
                className="overflow-x-auto pb-4 -mx-4 px-4 hide-scrollbar select-none"
              >
                <div className="flex space-x-4">
                  {isLoadingDevices ? (
                    // Loading skeleton
                    Array(3).fill(0).map((_, i) => (
                      <div 
                        key={i}
                        className="flex-shrink-0 w-64 h-32 bg-gray-800/50 rounded-xl animate-pulse"
                      />
                    ))
                  ) : connectedDevices.length > 0 ? (
                    // Device cards
                    connectedDevices.map((device) => (
                      <Link
                        key={device.deviceId}
                        href="/wearables"
                        className="flex-shrink-0 w-64 bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-800 hover:bg-gray-800/10 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${getStatusColor(device)} bg-gray-800/50`}>
                              <FaHeartbeat className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">{device.name}</h3>
                              <p className="text-sm text-gray-400">
                                Last sync: {formatLastSync(device.lastSync)}
                              </p>
                            </div>
                          </div>
                          {device.lastSync && (
                            <div 
                              className="text-primary-blue"
                              title="Sync device"
                            >
                              <FaSync className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className={`${getStatusColor(device)}`}>
                            {device.connected ? 'Connected' : 'Not Connected'}
                          </span>
                          <span className="text-primary-blue">
                            Details
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    // No devices message
                    <div className="flex-shrink-0 w-full bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <FaExclamationCircle className="w-8 h-8 text-gray-400" />
                        <p className="text-gray-400">No devices connected</p>
                        <Link href="/wearables" className="text-primary-blue hover:text-blue-400 transition-colors mt-2">
                          Connect a Device
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Fade effect for scroll indication */}
              {connectedDevices.length > 2 && (
                <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
              )}
            </div>
          </section>

          {/* Chats Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Chats</h2>
              <Link href="/" className="text-primary-blue hover:text-blue-400 transition-colors">
                See All
              </Link>
            </div>
            
            <div className="relative">
              <div 
                {...chatsScroll}
                className="overflow-x-auto pb-4 -mx-4 px-4 hide-scrollbar select-none"
              >
                <div className="flex space-x-4">
                  {sampleChats.map((chat) => (
                    <Link
                      key={chat.id}
                      href="/"
                      className={`flex-shrink-0 w-72 bg-gradient-to-br ${
                        chat.id === 'new' 
                          ? 'from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30' 
                          : 'from-gray-800/50 to-gray-700/50 hover:from-gray-800/60 hover:to-gray-700/60'
                      } backdrop-blur-sm rounded-xl p-4 border border-gray-800/50 transition-all cursor-pointer`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${
                          chat.id === 'new' ? 'bg-blue-500/30' : 'bg-gray-900/30'
                        }`}>
                          {chat.id === 'new' ? (
                            <FaPlus className="w-5 h-5 text-blue-400" />
                          ) : (
                            <FaComments className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white">
                            {chat.title}
                          </h3>
                          <p className="text-sm text-gray-300 line-clamp-2 mt-1">
                            {chat.preview}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              
              {/* Fade effect for scroll indication */}
              <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
            </div>
          </section>

          {/* Health Metrics Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Health Metrics</h2>
              <button className="text-primary-blue hover:text-blue-400 transition-colors">
                See All
              </button>
            </div>
            
            <div className="relative">
              <div 
                {...metricsScroll}
                className="overflow-x-auto pb-4 -mx-4 px-4 hide-scrollbar select-none"
              >
                <div className="flex space-x-4">
                  {sampleMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className={`flex-shrink-0 w-64 bg-gradient-to-br ${metric.color} backdrop-blur-sm rounded-xl p-4 border border-gray-800/50 cursor-pointer hover:bg-gray-800/10 transition-colors`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 rounded-full bg-gray-900/30">
                          {metric.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white">
                            {metric.title}
                          </h3>
                          <div className="mt-1">
                            <div className="flex items-baseline space-x-1">
                              <span className="text-lg font-semibold text-white">
                                {metric.value}
                              </span>
                              {metric.unit && (
                                <span className="text-sm text-gray-300">
                                  {metric.unit}
                                </span>
                              )}
                            </div>
                            {metric.target && (
                              <p className="text-sm text-gray-300 mt-0.5">
                                Target: {metric.target}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex justify-end text-sm">
                        <span className={metric.color}>
                          {metric.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Fade effect for scroll indication */}
              <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
} 