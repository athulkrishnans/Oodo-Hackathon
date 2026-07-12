import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, FuelLog, Vehicle } from '@/lib/types';
import {
  PageHeader, Button, Table, Th, Td, Badge, Loading, ErrorBox, EmptyState, Modal, Field, Input, Select,
} from '@/components/ui';
import { fmtDate, fmtNum } from '@/lib/utils';

export function FuelPage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'FINANCIAL_ANALYST';
  const [modal, setModal] = useState(false);
  const { data, loading, error, reload } = useApiGet<Paginated<FuelLog>>('/fuel-logs?limit=100');
  const vehicles = useApiGet<Paginated<Vehicle>>('/vehicles?limit=100');

  return (
    <div>
      <PageHeader title="Fuel Logs" subtitle="Anomalies flag fuel > 20% above rolling history"
        actions={canWrite ? <Button onClick={() => setModal(true)}>Add Fuel Log</Button> : undefined} />

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No fuel logs." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr>
            <Th>Date</Th><Th>Vehicle</Th><Th>Liters</Th><Th>Expected</Th><Th>Deviation</Th><Th>Cost</Th><Th>Flag</Th>
          </tr></thead>
          <tbody>
            {data.data.map((f) => (
              <tr key={f.id}>
                <Td>{fmtDate(f.date)}</Td>
                <Td>{f.vehicle?.registrationNumber ?? f.vehicleId.slice(0, 8)}</Td>
                <Td>{fmtNum(f.liters, 1)}</Td>
                <Td>{f.expectedLiters != null ? fmtNum(f.expectedLiters, 1) : '—'}</Td>
                <Td>{f.deviationPct != null ? `${(f.deviationPct * 100).toFixed(0)}%` : '—'}</Td>
                <Td>{fmtNum(f.cost)}</Td>
                <Td>{f.isAnomaly ? <Badge tone="red">anomaly</Badge> : <Badge tone="green">ok</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {modal && (
        <CreateFuelModal
          vehicles={vehicles.data?.data.filter((v) => v.fuelType !== 'EV') ?? []}
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateFuelModal({ vehicles, onClose, onCreated }: { vehicles: Vehicle[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ vehicleId: '', liters: '', cost: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.post('/fuel-logs', { vehicleId: form.vehicleId, liters: Number(form.liters), cost: Number(form.cost) });
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add Fuel Log">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Vehicle (non-EV)">
          <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.fuelType}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Liters"><Input type="number" step="any" value={form.liters} onChange={(e) => set('liters', e.target.value)} required /></Field>
          <Field label="Cost"><Input type="number" step="any" value={form.cost} onChange={(e) => set('cost', e.target.value)} required /></Field>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}
