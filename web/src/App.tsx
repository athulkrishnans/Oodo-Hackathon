import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';

// Pages — one per nav item (Section 12)
import { DashboardPage } from './pages/DashboardPage';
import { VehiclesPage } from './pages/fleet/VehiclesPage';
import { MaintenancePage } from './pages/fleet/MaintenancePage';
import { TripsPage } from './pages/dispatch/TripsPage';
import { DriversPage } from './pages/dispatch/DriversPage';
import { NewTripPage } from './pages/dispatch/NewTripPage';
import { FuelPage } from './pages/finance/FuelPage';
import { ExpensesPage } from './pages/finance/ExpensesPage';
import { AnomaliesPage } from './pages/finance/AnomaliesPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Fleet — M2 */}
        <Route path="fleet/vehicles" element={<VehiclesPage />} />
        <Route path="fleet/maintenance" element={<MaintenancePage />} />

        {/* Dispatch — M3 */}
        <Route path="dispatch/trips" element={<TripsPage />} />
        <Route path="dispatch/drivers" element={<DriversPage />} />
        <Route path="dispatch/new-trip" element={<NewTripPage />} />

        {/* Finance — M4 */}
        <Route path="finance/fuel" element={<FuelPage />} />
        <Route path="finance/expenses" element={<ExpensesPage />} />
        <Route path="finance/anomalies" element={<AnomaliesPage />} />

        {/* Reports */}
        <Route path="reports" element={<ReportsPage />} />

        {/* Admin */}
        <Route path="admin/users" element={<UsersPage />} />
        <Route path="admin/settings" element={<SettingsPage />} />
        <Route path="admin/audit-log" element={<AuditLogPage />} />
      </Route>
    </Routes>
  );
}
