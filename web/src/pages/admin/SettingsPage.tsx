// SettingsPage.tsx — M1 implements in H2-3.5
// ADMIN only: all settings from Section 4, including dispatch weights (sum-100 enforced)
export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      {/* TODO M1: anomaly threshold, min history, license warning days */}
      {/* TODO M1: dispatch weights — 4 sliders that enforce sum=100 */}
      {/* TODO M1: default service interval, simulate day toggle */}
      <p className="text-sm text-muted-foreground">Implemented in H2-3.5 (M1) — ADMIN only</p>
    </div>
  );
}
