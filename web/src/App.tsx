import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

const ChatPage = lazy(() => import('./pages/Chat/ChatPage'));
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));
const AdminLoginPage = lazy(() => import('./pages/Admin/AdminLoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/Auth/AuthCallbackPage'));
const LocalLoginPage = lazy(() => import('./pages/Auth/LocalLoginPage'));
const KnowledgePage = lazy(() => import('./pages/Knowledge/KnowledgePage'));
const KbAnalyticsPage = lazy(() => import('./pages/Knowledge/KbAnalyticsPage'));

export default function App() {
  return (
    <BrowserRouter><Suspense fallback={<main className="route-loading">正在加载...</main>}>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/login" element={<LocalLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/analytics" element={<KbAnalyticsPage />} />
      </Routes>
    </Suspense></BrowserRouter>
  );
}
