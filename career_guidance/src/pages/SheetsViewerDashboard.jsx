/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Users, 
  TrendingUp, 
  Download, 
  ExternalLink,
  Search,
  Trash2,
  RefreshCw,
  BarChart3,
  Award
} from 'lucide-react';

export default function SheetsViewerDashboard() {
  const [activeTab, setActiveTab] = useState('all');
  const [quizData, setQuizData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sheetUrl, setSheetUrl] = useState('');

  const API_URL = 'https://careerguidance-10.onrender.com';

  // Fetch all quiz data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sheets/view-all`);
      const data = await res.json();
      
      if (data.success) {
        setQuizData(data.data);
        setSheetUrl(data.sheetUrl);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sheets/stats`);
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Search quizzes
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchAllData();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sheets/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, filterBy })
      });
      const data = await res.json();
      
      if (data.success) {
        setQuizData(data.results);
      }
    } catch (error) {
      console.error('Error searching:', error);
    }
    setLoading(false);
  };

  // Download CSV
  const downloadCSV = () => {
    window.open(`${API_URL}/api/sheets/export-csv`, '_blank');
  };

  // Open sheet in new tab
  const openSheet = () => {
    window.open(sheetUrl, '_blank');
  };

  useEffect(() => {
    fetchAllData();
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Quiz Results Dashboard</h1>
                <p className="text-gray-600">Google Sheets Data Viewer</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={fetchAllData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={openSheet}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <ExternalLink className="w-4 h-4" />
                Open Sheet
              </button>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{stats.totalQuizzes}</span>
                </div>
                <p className="text-blue-100">Total Quizzes</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{stats.uniqueUsers}</span>
                </div>
                <p className="text-purple-100">Unique Users</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{stats.averageScore}%</span>
                </div>
                <p className="text-green-100">Average Score</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-8 h-8 opacity-80" />
                  <span className="text-3xl font-bold">{stats.highestScore}%</span>
                </div>
                <p className="text-orange-100">Highest Score</p>
              </div>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name, email, or career..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Fields</option>
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="career">Career</option>
            </select>
            
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
            >
              Search
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-20">
                <RefreshCw className="w-12 h-12 text-purple-500 animate-spin" />
              </div>
            ) : quizData.length === 0 ? (
              <div className="text-center p-20">
                <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No quiz data found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Timestamp</th>
                    <th className="px-6 py-4 text-left font-semibold">Email</th>
                    <th className="px-6 py-4 text-left font-semibold">Name</th>
                    <th className="px-6 py-4 text-center font-semibold">Quiz #</th>
                    <th className="px-6 py-4 text-center font-semibold">Score</th>
                    <th className="px-6 py-4 text-center font-semibold">Readiness</th>
                    <th className="px-6 py-4 text-left font-semibold">Career Match</th>
                    <th className="px-6 py-4 text-left font-semibold">Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quizData.map((row, index) => (
                    <tr 
                      key={index} 
                      className="hover:bg-purple-50 transition cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {row.Timestamp}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {row.Email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {row['Full Name']}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 bg-purple-100 text-purple-700 rounded-full font-bold">
                          {row['Quiz #']}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold ${
                          parseInt(row['Score %']) >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : parseInt(row['Score %']) >= 50
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {row['Score %']}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700">
                        {row['Career Readiness']}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {row['Primary Career']}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        {row['Salary Range']}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Users Section */}
        {stats?.topUsers && stats.topUsers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <Award className="w-8 h-8 text-yellow-500" />
              Top Performers
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {stats.topUsers.slice(0, 6).map((user, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-100"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-500' : 'bg-purple-500'
                  }`}>
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{user.avgScore}%</p>
                    <p className="text-xs text-gray-500">{user.totalQuizzes} quizzes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p className="text-sm">
            Data synced from Google Sheets • Last updated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}