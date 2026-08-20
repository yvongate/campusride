import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ConducteursPage from './pages/ConducteursPage';
import SignalementsPage from './pages/SignalementsPage';
import ComptesPage from './pages/ComptesPage';
import SupportPage from './pages/SupportPage';
import UniversitesPage from './pages/UniversitesPage';
import CommunesQuartiersPage from './pages/CommunesQuartiersPage';
import PointsInteretPage from './pages/PointsInteretPage';
import ProtectedRoute from './routes/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/conducteurs"
          element={
            <ProtectedRoute>
              <ConducteursPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/universites"
          element={
            <ProtectedRoute>
              <UniversitesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/communes-quartiers"
          element={
            <ProtectedRoute>
              <CommunesQuartiersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/points-interet"
          element={
            <ProtectedRoute>
              <PointsInteretPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/signalements"
          element={
            <ProtectedRoute>
              <SignalementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comptes"
          element={
            <ProtectedRoute>
              <ComptesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
