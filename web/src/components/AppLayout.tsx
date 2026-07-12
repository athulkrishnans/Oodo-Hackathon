// AppLayout.tsx — persistent shell with nav sidebar
// Nav items hidden per role (Section 12) — role check implemented in H1-2 when auth is live.

import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Wrench,
  Route,
  Users,
  PlusCircle,
  Fuel,
  Receipt,
  AlertTriangle,
  BarChart3,
  UserCog,
  Settings,
  ScrollText,
  Bell,
} from 'lucide-react';

const navSections = [
  {
    label: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { to: '/fleet/vehicles', icon: Truck, label: 'Vehicles' },
      { to: '/fleet/maintenance', icon: Wrench, label: 'Maintenance' },
    ],
  },
  {
    label: 'Dispatch',
    items: [
      { to: '/dispatch/trips', icon: Route, label: 'Trips' },
      { to: '/dispatch/drivers', icon: Users, label: 'Drivers' },
      { to: '/dispatch/new-trip', icon: PlusCircle, label: 'New Trip' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance/fuel', icon: Fuel, label: 'Fuel' },
      { to: '/finance/expenses', icon: Receipt, label: 'Expenses' },
      { to: '/finance/anomalies', icon: AlertTriangle, label: 'Anomalies' },
    ],
  },
  {
    label: null,
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', icon: UserCog, label: 'Users' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
      { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log' },
    ],
  },
];

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <span className="font-bold text-primary text-lg tracking-tight">TransitOps</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section, i) => (
            <div key={i}>
              {section.label && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
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
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-end px-6 gap-4">
          <button
            type="button"
            className="relative p-2 rounded-md hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {/* TODO: notification badge count */}
          </button>
          {/* TODO: user avatar / role badge */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
