import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { ChatShell } from '@/layouts/ChatShell';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ChatPage } from '@/pages/ChatPage';
import { EmptyChatPage } from '@/pages/EmptyChatPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { VoiceCallPage } from '@/pages/VoiceCallPage';
import { VideoCallPage } from '@/pages/VideoCallPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Protected app shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Chat two-pane (list + thread) */}
        <Route element={<ChatShell />}>
          <Route index element={<EmptyChatPage />} />
          <Route path="chat/:chatKey" element={<ChatPage />} />
        </Route>

        {/* Full-width pages */}
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="call/voice" element={<VoiceCallPage />} />
        <Route path="call/video" element={<VideoCallPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
