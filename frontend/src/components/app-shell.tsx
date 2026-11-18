import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartColumnIncreasing, ChevronsUpDown, LayoutDashboard, LogOut, Menu, ReceiptText, Settings2, Tags,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Logo } from '@/components/logo';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transaksi', icon: ReceiptText },
  { to: '/app/categories', label: 'Kategori', icon: Tags },
  { to: '/app/reports', label: 'Laporan', icon: ChartColumnIncreasing },
  { to: '/app/settings', label: 'Pengaturan', icon: Settings2 },
];

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-4">
        <Logo />
      </div>
      <div className="px-3 pb-2">
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Usaha</p>
          <p className="truncate text-sm font-medium">{session?.business.name}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Menu</p>
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
              isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md text-xs">{initials(session?.user.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{session?.user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{session?.user.email}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{session?.user.name}</span>
              <span className="block text-xs text-muted-foreground">Pemilik usaha</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { onNavigate?.(); navigate('/app/settings'); }}><Settings2 />Pengaturan</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { void logout().finally(() => navigate('/')); }}><LogOut />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = [...nav].reverse().find(n => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return (
    <div className="min-h-svh bg-sidebar">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-sidebar md:block">
        <SidebarContent />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigasi</SheetTitle>
          <SheetDescription className="sr-only">Menu utama UsahaCerdas</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="md:pl-60">
        <div className="min-h-svh bg-background md:my-2 md:mr-2 md:min-h-[calc(100svh-1rem)] md:rounded-xl md:border md:shadow-xs">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:rounded-t-xl md:px-6">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Buka menu" onClick={() => setOpen(true)}>
              <Menu />
            </Button>
            <span className="md:hidden"><Logo compact /></span>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="hidden text-muted-foreground sm:inline">UsahaCerdas</span>
              <span className="hidden text-muted-foreground sm:inline">/</span>
              <span className="truncate font-medium">{current?.label ?? 'Dashboard'}</span>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
