import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, Vehicle, VehicleType, FuelType } from '@/lib/types';
import {
  PageHeader, Button, Card, Table, Th, Td, Badge, statusTone, Loading, ErrorBox, EmptyState,
  Modal, Field, Input, Select,
} from '@/components/ui';
import { fmtNum } from '@/lib/utils';

const TYPES: VehicleType[] = ['TRUCK', 'VAN', 'PICKUP', 'BIKE', 'BUS'];
const FUELS: FuelType[] = ['DIESEL', 'PETROL', 'CNG', 'EV'];
const STATUSES = ['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'];

export function VehiclesPage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'FLEET_MANAGER';
  const [typeF, setTypeF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [regionF, setRegionF] = useState('');
  const [modal, setModal] = useState(false);

  const qs = new URLSearchParams();
  qs.set('limit', '100');
  if (typeF) qs.set('type', typeF);
  if (statusF) qs.set('status', statusF);
  if (regionF) qs.set('region', regionF);
  const { data, loading, error, reload } = useApiGet<Paginated<Vehicle>>(`/vehicles?${qs.toString()}`, [typeF, statusF, regionF]);

  async function retire(id: string) {
    try {
      await api.post(`/vehicles/${id}/retire`, {});
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to retire');
    }
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet inventory and status"
        actions={canWrite ? <Button onClick={() => setModal(true)}>Add Vehicle</Button> : undefined}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Field label="Type">
            <Select value={typeF} onChange={(e) => setTypeF(e.target.value)}>
              <option value="">All types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Region">
            <Input value={regionF} onChange={(e) => setRegionF(e.target.value)} placeholder="Filter by region" />
          </Field>
        </div>
      </Card>

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No vehicles match these filters." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Registration</Th><Th>Name</Th><Th>Type</Th><Th>Fuel</Th>
              <Th>Capacity (kg)</Th><Th>Odometer</Th><Th>km/L</Th><Th>Status</Th>
              {canWrite && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {data.data.map((v) => (
              <tr key={v.id}>
                <Td className="font-medium">{v.registrationNumber}</Td>
                <Td>{v.name}</Td>
                <Td>{v.type}</Td>
                <Td>{v.fuelType}</Td>
                <Td>{fmtNum(v.maxLoadCapacityKg)}</Td>
                <Td>{fmtNum(v.odometerKm)}</Td>
                <Td>{v.avgKmPerLiter != null ? fmtNum(v.avgKmPerLiter, 1) : '—'}</Td>
                <Td><Badge tone={statusTone(v.status)}>{v.status}</Badge></Td>
                {canWrite && (
                  <Td>
                    {v.status !== 'RETIRED' && (
                      <Button variant="outline" onClick={() => retire(v.id)}>Retire</Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {modal && <CreateVehicleModal onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </div>
  );
}

function CreateVehicleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    registrationNumber: '', name: '', model: '', type: 'TRUCK', fuelType: 'DIESEL',
    maxLoadCapacityKg: '', odometerKm: '', acquisitionCost: '', region: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/vehicles', {
        registrationNumber: form.registrationNumber,
        name: form.name,
        model: form.model || undefined,
        type: form.type,
        fuelType: form.fuelType,
        maxLoadCapacityKg: Number(form.maxLoadCapacityKg),
        odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
        acquisitionCost: Number(form.acquisitionCost),
        region: form.region || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create vehicle');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Vehicle">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Registration number"><Input value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Model"><Input value={form.model} onChange={(e) => set('model', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field label="Fuel type">
            <Select value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>{FUELS.map((f) => <option key={f}>{f}</option>)}</Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max load capacity (kg)"><Input type="number" step="any" value={form.maxLoadCapacityKg} onChange={(e) => set('maxLoadCapacityKg', e.target.value)} required /></Field>
          <Field label="Odometer (km)"><Input type="number" step="any" value={form.odometerKm} onChange={(e) => set('odometerKm', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Acquisition cost"><Input type="number" step="any" value={form.acquisitionCost} onChange={(e) => set('acquisitionCost', e.target.value)} required /></Field>
          <Field label="Region"><Input value={form.region} onChange={(e) => set('region', e.target.value)} /></Field>
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
