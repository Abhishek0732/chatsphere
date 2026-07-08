import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { ChatShell } from '@/layouts/ChatShell';
import { Spinner } from '@/components/ui/Spinner';
// Login/Register and the empty-chat placeholder are the first paint — keep them
// eager so there's no loading flash before auth.
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { EmptyChatPage } from '@/pages/EmptyChatPage';

// Everything else is code-split into its own chunk, so the initial bundle stays
// small and heavy screens (calls, settings, profile) load only when visited.
const ChatPage = lazy(() => import('@/pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const ContactsPage = lazy(() =>
  import('@/pages/ContactsPage').then((m) => ({ default: m.ContactsPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const VoiceCallPage = lazy(() =>
  import('@/pages/VoiceCallPage').then((m) => ({ default: m.VoiceCallPage })),
);
const VideoCallPage = lazy(() =>
  import('@/pages/VideoCallPage').then((m) => ({ default: m.VideoCallPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}
