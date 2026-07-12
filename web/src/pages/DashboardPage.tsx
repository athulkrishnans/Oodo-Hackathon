import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, Driver, FuelLog, AuditLogItem, Wrapped, AppSettings } from '@/lib/types';
import { Card, CardBody, PageHeader, Field, Select, Input, Badge, Button, Loading } from '@/components/ui';
import { daysUntil, fmtNum } from '@/lib/utils';

const TYPES = ['TRUCK', 'VAN', 'PICKUP', 'BIKE', 'BUS'];

function KpiCard({ label, path, extract, suffix }: { label: string; path: string; extract: (r: any) => number | null; suffix?: string }) {
  const { data, loading } = useApiGet<any>(path);
  const value = data ? extract(data) : null;
  return (
    <Card>
      <CardBody>
        <p className="mb-1 text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{loading ? '…' : value == null ? '—' : `${fmtNum(value, label.includes('%') ? 0 : 0)}${suffix ?? ''}`}</p>
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const { role } = useAuth();
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const vq = new URLSearchParams({ limit: '1' });
  if (type) vq.set('type', type);
  if (region) vq.set('region', region);
  const vfilter = `&${vq.toString().replace('limit=1', '')}`.replace('&&', '&');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const drivers = useApiGet<Paginated<Driver>>('/drivers?limit=100');
  const anomalies = useApiGet<Paginated<FuelLog>>('/fuel-logs/anomalies?limit=100');
  const canSeeAudit = role === 'ADMIN' || role === 'FLEET_MANAGER';
  const activity = useApiGet<Paginated<AuditLogItem>>(canSeeAudit ? '/audit-logs?limit=8' : null);
  const settings = useApiGet<Wrapped<AppSettings>>(role === 'ADMIN' ? '/settings' : null);

  const buckets = { r30: [] as Driver[], r60: [] as Driver[], r90: [] as Driver[] };
  for (const d of drivers.data?.data ?? []) {
    const days = daysUntil(d.licenseExpiryDate);
    if (days <= 30) buckets.r30.push(d);
    else if (days <= 60) buckets.r60.push(d);
    else if (days <= 90) buckets.r90.push(d);
  }
  const unreviewedAnomalies = (anomalies.data?.data ?? []).filter((f) => !f.anomalyReviewed);

  const [simMsg, setSimMsg] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  async function simulateDay() {
    setSimBusy(true); setSimMsg(null);
    try {
      await api.post('/jobs/simulate-day', {});
      setSimMsg('Simulate Day complete — refresh to see updated KPIs.');
    } catch (e) {
      setSimMsg(e instanceof ApiError ? `Simulate Day: ${e.message}` : 'Simulate Day failed');
    } finally { setSimBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Fleet operations at a glance"
        actions={
          role === 'ADMIN' && settings.data?.data.simulateDayEnabled ? (
            <Button onClick={simulateDay} disabled={simBusy}>{simBusy ? 'Simulating…' : 'Simulate Day'}</Button>
          ) : undefined
        }
      />

      {simMsg && <p className="mb-4 rounded-md border border-border bg-muted p-2 text-sm">{simMsg}</p>}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Vehicle type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Region"><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="All regions" /></Field>
        <div />
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Active Vehicles" path={`/vehicles?status=ON_TRIP&limit=1${vfilter}`} extract={(r) => r.meta.total} />
        <KpiCard label="Available Vehicles" path={`/vehicles?status=AVAILABLE&limit=1${vfilter}`} extract={(r) => r.meta.total} />
        <KpiCard label="In Maintenance" path={`/vehicles?status=IN_SHOP&limit=1${vfilter}`} extract={(r) => r.meta.total} />
        <KpiCard label="Active Trips" path="/trips?status=DISPATCHED&limit=1" extract={(r) => r.meta.total} />
        <KpiCard label="Pending (Draft) Trips" path="/trips?status=DRAFT&limit=1" extract={(r) => r.meta.total} />
        <KpiCard label="Drivers On Duty" path="/drivers?status=ON_TRIP&limit=1" extract={(r) => r.meta.total} />
        <KpiCard label="Fleet Utilization %" path="/reports/utilization" extract={(r) => Math.round(r.data.currentUtilization * 100)} suffix="%" />
        <KpiCard label="Fleet CO₂ this month (kg)" path={`/reports/carbon?from=${monthStart}`} extract={(r) => Math.round(r.data.fleetTotal)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* License expiry widget */}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold">License Expiry Risk</h2>
            {drivers.loading && <Loading />}
            <div className="space-y-2">
              <RiskRow tone="red" label="≤ 30 days" drivers={buckets.r30} />
              <RiskRow tone="amber" label="≤ 60 days" drivers={buckets.r60} />
              <RiskRow tone="gray" label="≤ 90 days" drivers={buckets.r90} />
            </div>
          </CardBody>
        </Card>

        {/* Anomaly card */}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold">Fuel Anomalies</h2>
            <p className="text-3xl font-bold text-red-700">{unreviewedAnomalies.length}</p>
            <p className="text-sm text-muted-foreground">unreviewed suspicious fuel log(s)</p>
            {unreviewedAnomalies.slice(0, 3).map((f) => (
              <p key={f.id} className="mt-2 text-xs">
                {f.vehicle?.registrationNumber ?? 'vehicle'} — {fmtNum(f.liters, 1)}L vs {f.expectedLiters != null ? fmtNum(f.expectedLiters, 1) : '—'}L expected
              </p>
            ))}
          </CardBody>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold">Recent Activity</h2>
            {!canSeeAudit && <p className="text-sm text-muted-foreground">Visible to admins and fleet managers.</p>}
            {canSeeAudit && (activity.data?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
            <ul className="space-y-2">
              {(activity.data?.data ?? []).map((a) => (
                <li key={a.id} className="text-xs">
                  <Badge tone="blue">{a.action}</Badge>{' '}
                  <span className="text-muted-foreground">{a.actor?.name ?? 'system'} · {new Date(a.timestamp).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function RiskRow({ tone, label, drivers }: { tone: 'red' | 'amber' | 'gray'; label: string; drivers: Driver[] }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        <span className="text-xs text-muted-foreground">{drivers.map((d) => d.name).slice(0, 2).join(', ')}{drivers.length > 2 ? ` +${drivers.length - 2}` : ''}</span>
      </div>
      <span className="font-semibold">{drivers.length}</span>
    </div>
  );
}
