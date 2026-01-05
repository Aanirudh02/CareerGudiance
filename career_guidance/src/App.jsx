import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';  // ADD THIS
import Dashboard from './pages/Dashboard.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AllProfiles from './pages/AllProfiles';


function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />  {/* ADD THIS */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      <Route path="/all-profiles" element={<AllProfiles />} />

      </Routes>
    </AuthProvider>
  );
}

export default App;
