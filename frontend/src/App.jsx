import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DeveloperDashboard from './pages/DeveloperDashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import CompanySignup from './pages/CompanySignup';
import AuditorDashboard from './pages/AuditorDashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<CompanySignup />} />

        {/* Protected — Developer only */}
        <Route
          path="/developer"
          element={
            <ProtectedRoute role="developer">
              <DeveloperDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected — Company Admin only */}
        <Route
          path="/company"
          element={
            <ProtectedRoute role="company">
              <CompanyDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected — Auditor only */}
        <Route
          path="/auditor"
          element={
            <ProtectedRoute role="auditor">
              <AuditorDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
