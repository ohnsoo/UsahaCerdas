import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LiveProvider } from '@/lib/live';
import AuthPage from '@/pages/auth';
import Categories from '@/pages/categories';
import Dashboard from '@/pages/dashboard';
import Landing from '@/pages/landing';
import Reports from '@/pages/reports';
import Settings from '@/pages/settings';
import Transactions from '@/pages/transactions';

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Memuat UsahaCerdas...
    </div>
  );
}

/** Layout route: satu AppShell dan satu koneksi realtime untuk semua halaman /app. */
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <LiveProvider><AppShell><Outlet /></AppShell></LiveProvider>;
}

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <Button asChild><Link to="/app">Kembali ke dashboard</Link></Button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="categories" element={<Categories />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
