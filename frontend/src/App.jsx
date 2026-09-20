import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Schedule from './pages/Schedule';
import StRecordings from './pages/StRecordings';
import CuratorsDatabase from './pages/CuratorsDatabase';
import Dashboard from './pages/Dashboard';
import CuratorCabinet from './pages/CuratorCabinet';
import TeacherCabinet from './pages/TeacherCabinet';
import RecordingReview from './pages/RecordingReview';
import QuizLibrary from './pages/quiz/QuizLibrary';
import QuizEditor from './pages/quiz/QuizEditor';
import HostGame from './pages/quiz/HostGame';
import PlayGame from './pages/quiz/PlayGame';
import GameResults from './pages/quiz/GameResults';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

// Рөлге қарай бастапқы бет: мұғалімге жалпы кестенің қажеті жоқ, оған
// бірден өз апталық кестесі ашылады.
function HomeRedirect() {
  const role = JSON.parse(localStorage.getItem('user') || '{}').role;
  return <Navigate to={role === 'teacher' ? '/my-schedule' : '/schedule'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        <Route path="/st-recordings" element={<ProtectedRoute><StRecordings /></ProtectedRoute>} />
        <Route path="/curators" element={<ProtectedRoute><CuratorsDatabase /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* 👤 Куратордың жеке кабинеті — профиль + СТ-жазба тарихы бір бетте */}
        <Route path="/profile" element={<ProtectedRoute><CuratorCabinet /></ProtectedRoute>} />
        <Route path="/my-recordings" element={<Navigate to="/profile" replace />} />

        {/* 👩‍🏫 Мұғалімнің жеке кабинеті — тек өз апталық кестесі */}
        <Route path="/my-schedule" element={<ProtectedRoute><TeacherCabinet /></ProtectedRoute>} />

        {/* 🎥 СТ жазбасын бағалау: видео + уақыт белгілі ескертулер */}
        <Route path="/review/:recordingId" element={<ProtectedRoute><RecordingReview /></ProtectedRoute>} />

        {/* ⚡ Тірі викторина (Kahoot үлгісі): құру, жүргізу, нәтиже. Ойыншыға
            аккаунт керек емес — /play PIN арқылы ашық. */}
        <Route path="/play" element={<PlayGame />} />
        <Route path="/quizzes" element={<ProtectedRoute><QuizLibrary /></ProtectedRoute>} />
        <Route path="/quizzes/:id" element={<ProtectedRoute><QuizEditor /></ProtectedRoute>} />
        <Route path="/host/:id" element={<ProtectedRoute><HostGame /></ProtectedRoute>} />
        <Route path="/games/:id/results" element={<ProtectedRoute><GameResults /></ProtectedRoute>} />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  );
}