import React, { useState } from 'react';
import { Calendar, Download, TrendingUp, TrendingDown, BarChart3, FileText, Filter } from 'lucide-react';

export default function WaterUsage() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);

  const usageData = [
    { date: '2024-12-13', usage: 180, cost: 0.72, device: 'device-1' },
    { date: '2024-12-14', usage: 205, cost: 0.82, device: 'device-1' },
    { date: '2024-12-15', usage: 190, cost: 0.76, device: 'device-1' },
    { date: '2024-12-16', usage: 220, cost: 0.88, device: 'device-1' },
    { date: '2024-12-17', usage: 175, cost: 0.70, device: 'device-1' },
    { date: '2024-12-18', usage: 245, cost: 0.98, device: 'device-1' },
    { date: '2024-12-19', usage: 235, cost: 0.94, device: 'device-1' },
  ];

  const devices = [
    { id: 'all', name: 'All Devices' },
    { id: 'device-1', name: 'Main Building - Floor 1' },
    { id: 'device-2', name: 'Main Building - Floor 2' },
    { id: 'device-3', name: 'Utility Room' },
  ];

  const filteredData = selectedDevice === 'all' 
    ? usageData 
    : usageData.filter(d => d.device === selectedDevice);

  const totalUsage = filteredData.reduce((sum, day) => sum + day.usage, 0);
  const totalCost = filteredData.reduce((sum, day) => sum + day.cost, 0);
  const avgDaily = totalUsage / filteredData.length;
  const trend = filteredData[filteredData.length - 1]?.usage > filteredData[0]?.usage;

  const handleExport = (format: string) => {
    let content = '';
    let filename = '';
    
    if (format === 'csv') {
      content = 'Date,Usage (L),Cost ($)\n' + 
                filteredData.map(d => `${d.date},${d.usage},${d.cost}`).join('\n');
      filename = 'water-usage.csv';
    } else if (format === 'json') {
      content = JSON.stringify(filteredData, null, 2);
      filename = 'water-usage.json';
    } else {
      // PDF-like text format
      content = `Water Usage Report\n\nPeriod: ${selectedPeriod}\nDevice: ${devices.find(d => d.id === selectedDevice)?.name}\n\nTotal Usage: ${totalUsage}L\nTotal Cost: $${totalCost.toFixed(2)}\nDaily Average: ${avgDaily.toFixed(1)}L\n\nDaily Breakdown:\n` +
                filteredData.map(d => `${d.date}: ${d.usage}L ($${d.cost})`).join('\n');
      filename = 'water-usage-report.txt';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const generateReport = () => {
    const reportData = {
      period: selectedPeriod,
      device: devices.find(d => d.id === selectedDevice)?.name,
      summary: {
        totalUsage,
        totalCost,
        avgDaily,
        trend: trend ? 'increasing' : 'decreasing'
      },
      recommendations: [
        'Consider installing flow restrictors during peak hours',
        'Monitor device-2 for potential efficiency improvements',
        'Schedule maintenance for optimal performance'
      ],
      data: filteredData
    };

    const content = `WATER USAGE ANALYSIS REPORT\n\n` +
                   `Generated: ${new Date().toLocaleString()}\n` +
                   `Period: ${selectedPeriod}\n` +
                   `Device: ${reportData.device}\n\n` +
                   `SUMMARY\n` +
                   `Total Usage: ${totalUsage}L\n` +
                   `Total Cost: $${totalCost.toFixed(2)}\n` +
                   `Daily Average: ${avgDaily.toFixed(1)}L\n` +
                   `Trend: ${reportData.summary.trend}\n\n` +
                   `RECOMMENDATIONS\n` +
                   reportData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') +
                   `\n\nDETAILED DATA\n` +
                   filteredData.map(d => `${d.date}: ${d.usage}L ($${d.cost})`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'water-usage-analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Water Usage</h2>
          <p className="text-gray-600">Monitor and analyze your water consumption</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {devices.map(device => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">Last Year</option>
          </select>
          <button 
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button 
            onClick={generateReport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Usage</span>
            {trend ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUsage}L</p>
          <p className="text-sm text-gray-500">This {selectedPeriod}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Daily Average</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.round(avgDaily)}L</p>
          <p className="text-sm text-gray-500">Per day</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          <p className="text-sm text-gray-500">This {selectedPeriod}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Efficiency</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">92%</p>
          <p className="text-sm text-gray-500">vs target</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Daily Usage Chart</h3>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Interactive Chart</span>
          </div>
        </div>
        <div className="space-y-4">
          {filteredData.map((day, index) => (
            <div key={day.date} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-600">
                {new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{day.usage}L</span>
                  <span className="text-sm text-gray-500">${day.cost.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 hover:bg-blue-700" 
                    style={{ width: `${(day.usage / Math.max(...filteredData.map(d => d.usage))) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Device</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Main Building - Floor 1</span>
              <span className="text-sm font-medium text-gray-900">45%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Main Building - Floor 2</span>
              <span className="text-sm font-medium text-gray-900">35%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-teal-600 h-2 rounded-full" style={{ width: '35%' }} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Utility Room</span>
              <span className="text-sm font-medium text-gray-900">20%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '20%' }} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights & Recommendations</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Peak Usage Time</p>
              <p className="text-sm text-blue-700">8:00 AM - 10:00 AM weekdays</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-900">Efficiency Improvement</p>
              <p className="text-sm text-green-700">12% reduction vs last month</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm font-medium text-yellow-900">Recommendation</p>
              <p className="text-sm text-yellow-700">Consider flow restriction during peak hours</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900">Cost Optimization</p>
              <p className="text-sm text-purple-700">Potential savings: $45/month with smart scheduling</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Usage Data</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('csv')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-left"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-left"
              >
                Export as Report
              </button>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}