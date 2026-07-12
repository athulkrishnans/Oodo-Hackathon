import { useEffect, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import type { Wrapped, AppSettings, EmissionFactor } from '@/lib/types';
import { PageHeader, Card, CardBody, Button, Field, Input, ErrorBox, Loading, Table, Th, Td } from '@/components/ui';

export function SettingsPage() {
  const { data, loading, error, reload } = useApiGet<Wrapped<AppSettings>>('/settings');
  const factors = useApiGet<Wrapped<EmissionFactor[]>>('/emission-factors');

  const [form, setForm] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setForm(data.data); }, [data]);

  if (loading || !form) return <div><PageHeader title="Settings" />{loading ? <Loading /> : null}{error && <ErrorBox message={error.message} />}</div>;

  const weightSum = form.dispatchWeightCapacity + form.dispatchWeightFuel + form.dispatchWeightMaintenance + form.dispatchWeightSafety;
  const setNum = (k: keyof AppSettings, v: string) => setForm((f) => (f ? { ...f, [k]: Number(v) } : f));

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (!form) return;
      await api.put('/settings', {
        anomalyDeviationThreshold: form.anomalyDeviationThreshold,
        anomalyMinHistory: form.anomalyMinHistory,
        dispatchWeightCapacity: form.dispatchWeightCapacity,
        dispatchWeightFuel: form.dispatchWeightFuel,
        dispatchWeightMaintenance: form.dispatchWeightMaintenance,
        dispatchWeightSafety: form.dispatchWeightSafety,
        defaultServiceIntervalKm: form.defaultServiceIntervalKm,
      });
      setMsg('Settings saved.');
      reload();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Tunable thresholds and dispatch scoring weights" />

      <Card className="mb-6">
        <CardBody className="space-y-4">
          <h2 className="font-semibold">Dispatch scoring weights</h2>
          <p className="text-xs text-muted-foreground">Must sum to 100. Current sum: <span className={weightSum === 100 ? 'text-green-700' : 'text-red-700'}>{weightSum}</span></p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Capacity"><Input type="number" value={form.dispatchWeightCapacity} onChange={(e) => setNum('dispatchWeightCapacity', e.target.value)} /></Field>
            <Field label="Fuel"><Input type="number" value={form.dispatchWeightFuel} onChange={(e) => setNum('dispatchWeightFuel', e.target.value)} /></Field>
            <Field label="Maintenance"><Input type="number" value={form.dispatchWeightMaintenance} onChange={(e) => setNum('dispatchWeightMaintenance', e.target.value)} /></Field>
            <Field label="Safety"><Input type="number" value={form.dispatchWeightSafety} onChange={(e) => setNum('dispatchWeightSafety', e.target.value)} /></Field>
          </div>

          <h2 className="pt-2 font-semibold">Anomaly detection</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deviation threshold (0–1)"><Input type="number" step="0.01" value={form.anomalyDeviationThreshold} onChange={(e) => setNum('anomalyDeviationThreshold', e.target.value)} /></Field>
            <Field label="Min history"><Input type="number" value={form.anomalyMinHistory} onChange={(e) => setNum('anomalyMinHistory', e.target.value)} /></Field>
          </div>

          <Field label="Default service interval (km)"><Input type="number" value={form.defaultServiceIntervalKm} onChange={(e) => setNum('defaultServiceIntervalKm', e.target.value)} /></Field>

          {err && <ErrorBox message={err} />}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <div><Button onClick={save} disabled={busy || weightSum !== 100}>{busy ? 'Saving…' : 'Save settings'}</Button></div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 font-semibold">Emission factors (kg CO₂ / L)</h2>
          {factors.data && (
            <Table>
              <thead><tr><Th>Fuel</Th><Th>kg CO₂ / L</Th><Th>Source</Th></tr></thead>
              <tbody>
                {factors.data.data.map((f) => (
                  <tr key={f.id}><Td>{f.fuelType}</Td><Td>{f.kgCo2PerLiter}</Td><Td>{f.source}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
