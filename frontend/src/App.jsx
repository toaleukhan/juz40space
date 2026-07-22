import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import StRecordings from './pages/StRecordings';
import CuratorCabinet from './pages/CuratorCabinet';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        <Route path="/st-recordings" element={<ProtectedRoute><StRecordings /></ProtectedRoute>} />

        {/* 👤 Куратордың жеке кабинеті — профиль + СТ-жазба тарихы бір бетте */}
        <Route path="/profile" element={<ProtectedRoute><CuratorCabinet /></ProtectedRoute>} />
        <Route path="/my-recordings" element={<Navigate to="/profile" replace />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}