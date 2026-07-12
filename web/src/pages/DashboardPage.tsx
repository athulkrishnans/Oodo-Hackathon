// DashboardPage.tsx — M1 implements in H3.5-5
// KPI cards, filters, license expiry widget, anomaly card, activity feed, Simulate Day button
// Section 12 — all KPIs and widgets spec'd in BUILD_BIBLE.md Section 12
export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {/* KPI Cards — Section 12 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          'Active Vehicles',
          'Available Vehicles',
          'In Maintenance',
          'Active Trips',
          'Pending (Draft) Trips',
          'Drivers On Duty',
          'Fleet Utilization %',
          'Fleet CO₂ this month',
        ].map((kpi) => (
          <div key={kpi} className="border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">{kpi}</p>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          </div>
        ))}
      </div>

      {/* TODO M1: filters (vehicle type, status, region) */}
      {/* TODO M1: License Expiry Risk widget (≤30 red / ≤60 amber / ≤90 yellow) */}
      {/* TODO M1: Fuel anomaly alert card */}
      {/* TODO M1: Recent activity feed (from AuditLog) */}
      {/* TODO M1: Simulate Day button (ADMIN only, gated by simulate_day_enabled setting) */}
      <p className="text-sm text-muted-foreground">Full dashboard — implemented in H3.5-5 (M1)</p>
    </div>
  );
}
