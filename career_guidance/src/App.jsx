import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AllProfiles from './pages/AllProfiles';
import Analysis from './pages/Analysis';
import Calendar from './pages/Calender.jsx';
import SheetsViewerDashboard from './pages/SheetsViewerDashboard.jsx';
import Course from './pages/Course';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/dashboard/analysis" 
          element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/dashboard/calendar" 
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } 
        />
        
        {/* All Profiles Route */}
        <Route path="/all-profiles" element={<AllProfiles />} />

        <Route path="/dashboard/courses" element={<Course />} />

        
        
        {/* ✅ Sheets Viewer Route - MOVED INSIDE Routes */}
        <Route path="/sheets-viewer" element={<SheetsViewerDashboard />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;