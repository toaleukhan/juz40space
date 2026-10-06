import { Navigate, useLocation } from 'react-router-dom';

// Media team тимлиді (role = media) — тек TikTok бөлімі: басқа бетке кірсе
// (мыс. кіргеннен кейінгі /dashboard), бірден /tiktok-ке бұрылады.
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  if (role === 'media' && !location.pathname.startsWith('/tiktok')) return <Navigate to="/tiktok" replace />;
  return children;
}
