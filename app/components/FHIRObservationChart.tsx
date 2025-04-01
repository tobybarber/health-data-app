'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getObservationTimeline } from '../lib/fhir-service';
import { parseObservationValue } from '../lib/fhir-converter';
import { Observation } from '../types/fhir';

type ChartDataPoint = {
  date: string;
  value: number;
  unit: string;
  formattedDate?: string;
};

interface FHIRObservationChartProps {
  patientId: string;
  loincCode: string;
  title?: string;
  subtitle?: string;
  height?: number;
  width?: number;
}

export default function FHIRObservationChart({
  patientId,
  loincCode,
  title,
  subtitle,
  height = 200,
  width = 600
}: FHIRObservationChartProps) {
  const { currentUser } = useAuth();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ min?: number; max?: number }>({});

  useEffect(() => {
    async function fetchData() {
      if (!currentUser) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        console.log(`Fetching observations for patient ${patientId} with LOINC code ${loincCode}`);
        const timelineData = await getObservationTimeline(
          currentUser.uid,
          patientId,
          loincCode
        );
        console.log('Timeline data received:', timelineData);

        // Format dates and sort by date
        const formattedData = timelineData
          .map(item => {
            const date = new Date(item.date);
            // Format date as MMM YYYY (e.g., Jan 2023)
            const formattedDate = date.toLocaleString('en-US', { 
              month: 'short', 
              year: 'numeric' 
            });
            
            return {
              ...item,
              formattedDate
            };
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setChartData(formattedData);

        // Calculate range
        if (formattedData.length > 0) {
          const values = formattedData.map(item => item.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          
          // Increase vertical scale to +/- 50% of the range
          const rangePadding = (max - min) * 0.5;
          
          // If min and max are the same (only one value or all values identical),
          // create an artificial range to avoid division by zero
          if (min === max) {
            setRange({
              min: min * 0.5, // 50% below the value
              max: min * 1.5  // 50% above the value
            });
          } else {
            setRange({
              min: Math.max(0, min - rangePadding), // Don't go below zero for most medical tests
              max: max + rangePadding
            });
          }
        }
      } catch (err: any) {
        console.error('Error fetching observation data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser, patientId, loincCode]);

  if (loading) {
    return <div className="flex justify-center p-4">Loading observation data...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="border border-gray-600 rounded p-4 text-center bg-gray-900">
        <h3 className="text-lg font-semibold text-white">{title || 'Observation Chart'}</h3>
        <p className="text-gray-400">{subtitle}</p>
        <p className="mt-4 text-gray-300">No data available for this observation.</p>
      </div>
    );
  }

  // Calculate chart dimensions
  const chartWidth = width - 80; // Adjust for labels and padding
  const chartHeight = height - 60; // Reduced padding to fit smaller height
  const barWidth = Math.min(40, chartWidth / chartData.length - 10);

  // Scale the values to fit the chart height
  const scaleY = (value: number) => {
    if (range.min === undefined || range.max === undefined) return 0;
    return chartHeight - ((value - range.min) / (range.max - range.min)) * chartHeight;
  };

  return (
    <div className="border border-gray-600 rounded p-4 w-full bg-gray-900">
      <h3 className="text-lg font-semibold text-white">{title || 'Observation Chart'}</h3>
      <p className="text-gray-400">{subtitle}</p>
      
      <svg width={width} height={height} className="mt-4">
        {/* X-axis only - vertical axis removed */}
        <line
          x1={60}
          y1={chartHeight + 10}
          x2={chartWidth + 60}
          y2={chartHeight + 10}
          stroke="#555"
          strokeWidth={1}
        />
        
        {/* Y-axis labels without the line */}
        {range.min !== undefined && range.max !== undefined && (
          <>
            <text x={10} y={15} fontSize={12} fill="#ccc" textAnchor="start">
              {range.max.toFixed(1)} {chartData[0]?.unit}
            </text>
            <text x={10} y={chartHeight + 10} fontSize={12} fill="#ccc" textAnchor="start">
              {range.min.toFixed(1)} {chartData[0]?.unit}
            </text>
          </>
        )}
        
        {/* Line chart */}
        {chartData.length > 0 && (
          <g>
            {/* Create the line connecting all points */}
            <polyline
              points={chartData.map((dataPoint, index) => {
                const pointX = 60 + (chartWidth / (chartData.length - 1 || 1)) * index;
                const pointY = 10 + scaleY(dataPoint.value);
                return `${pointX},${pointY}`;
              }).join(' ')}
              fill="none"
              stroke="#4f46e5"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            
            {/* Add data points */}
            {chartData.map((dataPoint, index) => {
              const pointX = 60 + (chartWidth / (chartData.length - 1 || 1)) * index;
              const pointY = 10 + scaleY(dataPoint.value);
              
              return (
                <g key={index}>
                  {/* Data point */}
                  <circle
                    cx={pointX}
                    cy={pointY}
                    r={5}
                    fill="#4f46e5"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  
                  {/* Value label */}
                  <text
                    x={pointX}
                    y={pointY - 10}
                    fontSize={10}
                    fill="#ccc"
                    textAnchor="middle"
                  >
                    {dataPoint.value}
                  </text>
                  
                  {/* Date label - no rotation for cleaner look */}
                  <text
                    x={pointX}
                    y={chartHeight + 30}
                    fontSize={10}
                    fill="#ccc"
                    textAnchor="middle"
                  >
                    {dataPoint.formattedDate}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
} 