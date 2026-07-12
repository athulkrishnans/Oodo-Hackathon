import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Wrench, Route, Users, PlusCircle, Fuel, Receipt,
  AlertTriangle, BarChart3, UserCog, Settings, ScrollText, Bell, LogOut,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import type { Role, NotificationItem } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

interface NavItem { to: string; icon: typeof LayoutDashboard; label: string; roles: Role[] | 'all' }
interface NavSection { label: string | null; items: NavItem[] }

const ALL: 'all' = 'all';
const navSections: NavSection[] = [
  { label: null, items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ALL }] },
  {
    label: 'Fleet',
    items: [
      { to: '/fleet/vehicles', icon: Truck, label: 'Vehicles', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER'] },
      { to: '/fleet/maintenance', icon: Wrench, label: 'Maintenance', roles: ['ADMIN', 'FLEET_MANAGER'] },
    ],
  },
  {
    label: 'Dispatch',
    items: [
      { to: '/dispatch/trips', icon: Route, label: 'Trips', roles: ['ADMIN', 'DISPATCHER'] },
      { to: '/dispatch/drivers', icon: Users, label: 'Drivers', roles: ['ADMIN', 'SAFETY_OFFICER', 'DISPATCHER'] },
      { to: '/dispatch/new-trip', icon: PlusCircle, label: 'New Trip', roles: ['ADMIN', 'DISPATCHER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance/fuel', icon: Fuel, label: 'Fuel', roles: ['ADMIN', 'FINANCIAL_ANALYST'] },
      { to: '/finance/expenses', icon: Receipt, label: 'Expenses', roles: ['ADMIN', 'FINANCIAL_ANALYST'] },
      { to: '/finance/anomalies', icon: AlertTriangle, label: 'Anomalies', roles: ['ADMIN', 'FINANCIAL_ANALYST'] },
    ],
  },
  { label: null, items: [{ to: '/reports', icon: BarChart3, label: 'Reports', roles: ['ADMIN', 'FLEET_MANAGER', 'FINANCIAL_ANALYST'] }] },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', icon: UserCog, label: 'Users', roles: ['ADMIN'] },
      { to: '/admin/settings', icon: Settings, label: 'Settings', roles: ['ADMIN'] },
      { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log', roles: ['ADMIN', 'FLEET_MANAGER'] },
    ],
  },
];

function canSee(item: NavItem, role: Role | null): boolean {
  if (item.roles === ALL) return true;
  return role != null && item.roles.includes(role);
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, reload } = useApiGet<{ data: { items: NotificationItem[]; unreadCount: number } }>('/notifications?limit=10');
  const unread = data?.data.unreadCount ?? 0;
  const items = data?.data.items ?? [];

  async function markAll() {
    await api.post('/notifications/read-all', {});
    reload();
  }

  return (
    <div className="relative">
      <button type="button" className="relative rounded-md p-2 hover:bg-accent" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <button className="text-xs text-primary hover:underline" onClick={markAll}>Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No notifications</li>}
            {items.map((n) => (
              <li key={n.id} className={`border-b border-border px-3 py-2 text-sm ${n.read ? 'opacity-60' : ''}`}>
                <p>{n.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-border">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-lg font-bold tracking-tight text-primary">TransitOps</span>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navSections.map((section, i) => {
            const visible = section.items.filter((it) => canSee(it, role));
            if (visible.length === 0) return null;
            return (
              <div key={i}>
                {section.label && (
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
                )}
                <ul className="space-y-0.5">
                  {visible.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${
                            isActive ? 'bg-primary font-medium text-primary-foreground' : 'text-foreground hover:bg-accent'
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-end gap-4 border-b border-border px-6">
          <NotificationBell />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{role ?? 'Pending approval'}</p>
            </div>
            <button
              type="button"
              className="rounded-md p-2 hover:bg-accent"
              aria-label="Log out"
              onClick={() => { logout(); navigate('/login'); }}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
