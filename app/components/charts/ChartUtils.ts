// Utility functions for chart data formatting and processing

// Format date for readable display on charts
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Format time for display
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Generate chart background colors with opacity
export const generateBackgroundColors = (count: number, opacity: number = 0.2): string[] => {
  const colors = [
    `rgba(54, 162, 235, ${opacity})`,
    `rgba(255, 99, 132, ${opacity})`,
    `rgba(75, 192, 192, ${opacity})`,
    `rgba(255, 159, 64, ${opacity})`,
    `rgba(153, 102, 255, ${opacity})`,
    `rgba(255, 205, 86, ${opacity})`,
    `rgba(201, 203, 207, ${opacity})`
  ];
  
  // Repeat colors if needed
  return Array(count).fill(0).map((_, i) => colors[i % colors.length]);
};

// Generate chart border colors (solid)
export const generateBorderColors = (count: number): string[] => {
  const colors = [
    'rgb(54, 162, 235)',
    'rgb(255, 99, 132)',
    'rgb(75, 192, 192)',
    'rgb(255, 159, 64)',
    'rgb(153, 102, 255)',
    'rgb(255, 205, 86)',
    'rgb(201, 203, 207)'
  ];
  
  // Repeat colors if needed
  return Array(count).fill(0).map((_, i) => colors[i % colors.length]);
};

// Process heart rate data for charts
export const processHeartRateData = (data: any[]) => {
  if (!data || data.length === 0) return { labels: [], datasets: [] };
  
  // Sort by timestamp
  const sortedData = [...data].sort((a, b) => 
    new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  
  return {
    labels: sortedData.map(item => formatTime(item.dateTime)),
    datasets: [
      {
        label: 'Heart Rate (bpm)',
        data: sortedData.map(item => item.value),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1,
        pointBackgroundColor: 'rgb(255, 99, 132)',
        pointBorderColor: '#fff',
        pointRadius: 3,
        pointHoverRadius: 5,
      }
    ]
  };
};

// Process step count data for charts
export const processStepCountData = (data: any[]) => {
  if (!data || data.length === 0) return { labels: [], datasets: [] };
  
  // Sort by timestamp
  const sortedData = [...data].sort((a, b) => 
    new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  
  return {
    labels: sortedData.map(item => formatDate(item.dateTime)),
    datasets: [
      {
        label: 'Steps',
        data: sortedData.map(item => item.value),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(75, 192, 192, 0.9)',
      }
    ]
  };
};

// Process sleep data for charts
export const processSleepData = (data: any[]) => {
  if (!data || data.length === 0) return { labels: [], datasets: [] };
  
  // Sort by timestamp
  const sortedData = [...data].sort((a, b) => 
    new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  
  // Extract sleep stages data
  const sleepStages = sortedData.map(item => {
    const date = formatDate(item.dateTime);
    const deep = item.deep || 0;
    const light = item.light || 0;
    const rem = item.rem || 0;
    const wake = item.awake || 0;
    
    return { date, deep, light, rem, wake };
  });
  
  return {
    labels: sleepStages.map(item => item.date),
    datasets: [
      {
        label: 'Deep Sleep',
        data: sleepStages.map(item => item.deep),
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
        stack: 'Stack 0',
        borderRadius: 4,
      },
      {
        label: 'Light Sleep',
        data: sleepStages.map(item => item.light),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
        stack: 'Stack 0',
        borderRadius: 4,
      },
      {
        label: 'REM Sleep',
        data: sleepStages.map(item => item.rem),
        backgroundColor: 'rgba(153, 102, 255, 0.7)',
        borderColor: 'rgb(153, 102, 255)',
        borderWidth: 1,
        stack: 'Stack 0',
        borderRadius: 4,
      },
      {
        label: 'Awake',
        data: sleepStages.map(item => item.wake),
        backgroundColor: 'rgba(255, 159, 64, 0.7)',
        borderColor: 'rgb(255, 159, 64)',
        borderWidth: 1,
        stack: 'Stack 0',
        borderRadius: 4,
      }
    ]
  };
};

// Generic chart options
export const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
}; 