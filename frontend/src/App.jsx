import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import WhatsAppConnect from './pages/WhatsAppConnect';
import CuratorPanel from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import Schedule from './pages/Schedule';
import QualityTracker from './pages/QualityTracker';
import './index.css';

const PrivateRoute = ({ children }) => {
  const { curator, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F0F8FA', color:'#1B6E7E', fontSize:14 }}>
      Жүктелуде...
    </div>
  );
  return curator ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Тек login — ашық */}
          <Route path="/login"     element={<Login />} />

          {/* Барлық қалған беттер — авторизация керек */}
          <Route path="/"          element={<PrivateRoute><DashboardHome /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardHome /></PrivateRoute>} />
          <Route path="/schedule"  element={<PrivateRoute><Schedule onGoToCabinet={() => window.location.href='/curator'} /></PrivateRoute>} />
          <Route path="/tracker"   element={<PrivateRoute><QualityTracker /></PrivateRoute>} />

          {/* Куратор кабинеті */}
          <Route path="/whatsapp"  element={<PrivateRoute><WhatsAppConnect /></PrivateRoute>} />
          <Route path="/curator"   element={<PrivateRoute><CuratorPanel /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
