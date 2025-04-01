const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const processHeartRateData = (data: any[]) => {
  const sortedData = [...data].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    labels: sortedData.map(d => formatDate(d.timestamp)),
    datasets: [{
      label: 'Heart Rate',
      data: sortedData.map(d => d.value),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 0
    }]
  };
};

export const getHeartRateChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context: any) => `Heart Rate: ${context.parsed.y} bpm`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: '#9CA3AF'
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#9CA3AF'
      }
    }
  }
}); 