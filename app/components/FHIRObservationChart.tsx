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
  height = 300,
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
          .map(item => ({
            ...item,
            formattedDate: new Date(item.date).toLocaleDateString()
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setChartData(formattedData);

        // Calculate range
        if (formattedData.length > 0) {
          const values = formattedData.map(item => item.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const padding = (max - min) * 0.1;
          setRange({
            min: Math.max(0, min - padding),
            max: max + padding
          });
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
  const chartHeight = height - 80;
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
        {/* Y-axis */}
        <line
          x1={60}
          y1={10}
          x2={60}
          y2={chartHeight + 10}
          stroke="#555"
          strokeWidth={1}
        />
        
        {/* X-axis */}
        <line
          x1={60}
          y1={chartHeight + 10}
          x2={chartWidth + 60}
          y2={chartHeight + 10}
          stroke="#555"
          strokeWidth={1}
        />
        
        {/* Y-axis labels */}
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
        
        {/* Bars */}
        {chartData.map((dataPoint, index) => {
          const barX = 60 + (chartWidth / chartData.length) * index + (chartWidth / chartData.length - barWidth) / 2;
          const barY = 10 + scaleY(dataPoint.value);
          const barHeight = chartHeight - scaleY(dataPoint.value);
          
          return (
            <g key={index}>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill="#4f46e5"
                rx={2}
              />
              <text
                x={barX + barWidth / 2}
                y={chartHeight + 30}
                fontSize={10}
                fill="#ccc"
                textAnchor="middle"
                transform={`rotate(45, ${barX + barWidth / 2}, ${chartHeight + 30})`}
              >
                {dataPoint.formattedDate}
              </text>
              <text
                x={barX + barWidth / 2}
                y={barY - 5}
                fontSize={10}
                fill="#ccc"
                textAnchor="middle"
              >
                {dataPoint.value}
              </text>
            </g>
          );
        })}
      </svg>
      
      <div className="text-xs text-gray-400 mt-6 text-center">
        {chartData.length} data points | LOINC: {loincCode}
      </div>
    </div>
  );
} 