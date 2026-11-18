import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { AuthProvider, useAuth } from '@/lib/auth';
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

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
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
        <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/app/transactions" element={<RequireAuth><Transactions /></RequireAuth>} />
        <Route path="/app/categories" element={<RequireAuth><Categories /></RequireAuth>} />
        <Route path="/app/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        <Route path="/app/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
