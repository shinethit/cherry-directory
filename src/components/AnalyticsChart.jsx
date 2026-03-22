import { useEffect, useRef } from 'react'

// Chart.js loaded via CDN
export default function AnalyticsChart({ data = [], label = 'Views', color = '#a200e6' }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!data.length) return

    function initChart() {
      const L = window.Chart
      if (!L || !canvasRef.current) return
      if (chartRef.current) chartRef.current.destroy()

      chartRef.current = new L(canvasRef.current, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label,
            data: data.map(d => d.value),
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: color,
            pointBorderColor: '#0d0015',
            pointBorderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a0030',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              titleColor: '#fff',
              bodyColor: 'rgba(255,255,255,0.7)',
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
              beginAtZero: true,
            },
          },
        },
      })
    }

    if (window.Chart) {
      initChart()
    } else {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
      script.onload = initChart
      document.head.appendChild(script)
    }

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data, label, color])

  return <canvas ref={canvasRef} style={{ height: '180px' }} />
}
