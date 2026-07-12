import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, MaintenanceLog, Vehicle, MaintenanceType } from '@/lib/types';
import {
  PageHeader, Button, Card, Table, Th, Td, Badge, statusTone, Loading, ErrorBox, EmptyState,
  Modal, Field, Input, Select, Textarea,
} from '@/components/ui';
import { fmtDate, fmtNum } from '@/lib/utils';

const TYPES: MaintenanceType[] = ['SERVICE', 'REPAIR', 'INSPECTION'];

export function MaintenancePage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'FLEET_MANAGER';
  const [statusF, setStatusF] = useState('');
  const [modal, setModal] = useState(false);

  const qs = new URLSearchParams({ limit: '100' });
  if (statusF) qs.set('status', statusF);
  const { data, loading, error, reload } = useApiGet<Paginated<MaintenanceLog>>(`/maintenance-logs?${qs.toString()}`, [statusF]);
  const vehicles = useApiGet<Paginated<Vehicle>>('/vehicles?limit=100');

  const vehicleName = (id: string) => vehicles.data?.data.find((v) => v.id === id)?.registrationNumber ?? id.slice(0, 8);

  async function close(id: string) {
    try { await api.post(`/maintenance-logs/${id}/close`, {}); reload(); vehicles.reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : 'Failed to close'); }
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Open jobs auto-move a vehicle to IN_SHOP; closing restores AVAILABLE"
        actions={canWrite ? <Button onClick={() => setModal(true)}>Open Maintenance</Button> : undefined}
      />
      <Card className="mb-4">
        <div className="p-4 sm:max-w-xs">
          <Field label="Status">
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">All</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option>
            </Select>
          </Field>
        </div>
      </Card>

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No maintenance logs." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr>
            <Th>Vehicle</Th><Th>Type</Th><Th>Description</Th><Th>Cost</Th><Th>Opened</Th><Th>Status</Th>{canWrite && <Th>Actions</Th>}
          </tr></thead>
          <tbody>
            {data.data.map((m) => (
              <tr key={m.id}>
                <Td className="font-medium">{vehicleName(m.vehicleId)}</Td>
                <Td>{m.type}</Td>
                <Td>{m.description}</Td>
                <Td>{fmtNum(m.cost)}</Td>
                <Td>{fmtDate(m.openedAt)}</Td>
                <Td><Badge tone={statusTone(m.status)}>{m.status}</Badge></Td>
                {canWrite && <Td>{m.status === 'OPEN' && <Button variant="outline" onClick={() => close(m.id)}>Close</Button>}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {modal && (
        <OpenMaintenanceModal
          vehicles={vehicles.data?.data.filter((v) => v.status === 'AVAILABLE') ?? []}
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); reload(); vehicles.reload(); }}
        />
      )}
    </div>
  );
}

function OpenMaintenanceModal({ vehicles, onClose, onCreated }: { vehicles: Vehicle[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ vehicleId: '', type: 'SERVICE', description: '', cost: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.post('/maintenance-logs', {
        vehicleId: form.vehicleId, type: form.type, description: form.description,
        cost: form.cost ? Number(form.cost) : undefined,
      });
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Open Maintenance">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Vehicle (available only)">
          <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.name}</option>)}
          </Select>
        </Field>
        <Field label="Type"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} required rows={2} /></Field>
        <Field label="Cost"><Input type="number" step="any" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Open'}</Button>
        </div>
      </form>
    </Modal>
  );
}
