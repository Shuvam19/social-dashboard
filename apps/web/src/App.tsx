import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { ConnectAccountPage } from '@/features/accounts/ConnectAccountPage';
import { PostsPage } from '@/features/posts/PostsPage';
import { CreatePostPage } from '@/features/posts/CreatePostPage';
import { InboxPage } from '@/features/inbox/InboxPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { CampaignDetailPage } from '@/features/campaigns/CampaignDetailPage';
import { CreateCampaignPage } from '@/features/campaigns/CreateCampaignPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { Toaster } from '@/components/ui/toaster';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" /> : <>{children}</>;
}

function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/connect" element={<ConnectAccountPage />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="posts/create" element={<CreatePostPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/create" element={<CreateCampaignPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
