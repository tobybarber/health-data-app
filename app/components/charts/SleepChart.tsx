'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { processSleepData, chartOptions } from './ChartUtils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SleepChartProps {
  data: any[];
  height?: number;
}

export default function SleepChart({ data, height = 300 }: SleepChartProps) {
  const chartData = processSleepData(data);
  
  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: 'Sleep Stages (Minutes)',
        color: '#e2e8f0',
        font: {
          size: 16,
        },
      },
      legend: {
        ...chartOptions.plugins.legend,
        labels: {
          color: '#e2e8f0',
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        stacked: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#a0aec0',
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#a0aec0',
        }
      },
    },
  };

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      {data && data.length > 0 ? (
        <Bar options={options} data={chartData} />
      ) : (
        <div className="flex items-center justify-center h-full w-full bg-gray-800 rounded-lg">
          <p className="text-gray-400">No sleep data available</p>
        </div>
      )}
    </div>
  );
} 