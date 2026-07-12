import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, Trip } from '@/lib/types';
import {
  PageHeader, Button, Card, Table, Th, Td, Badge, statusTone, Loading, ErrorBox, EmptyState,
  Modal, Field, Input, Select,
} from '@/components/ui';
import { fmtNum, fmtDate } from '@/lib/utils';

const STATUSES = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

export function TripsPage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'DISPATCHER';
  const [statusF, setStatusF] = useState('');
  const [completing, setCompleting] = useState<Trip | null>(null);

  const qs = new URLSearchParams({ limit: '100' });
  if (statusF) qs.set('status', statusF);
  const { data, loading, error, reload } = useApiGet<Paginated<Trip>>(`/trips?${qs.toString()}`, [statusF]);

  async function act(id: string, action: 'dispatch' | 'cancel') {
    try {
      // Idempotency-Key guards against double-click double-dispatch (Section 7).
      const headers = action === 'dispatch' ? { 'Idempotency-Key': `dispatch-${id}` } : undefined;
      await api.post(`/trips/${id}/${action}`, {}, headers);
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Action failed');
    }
  }

  return (
    <div>
      <PageHeader title="Trips" subtitle="Dispatch, complete, and cancel trips" />
      <Card className="mb-4">
        <div className="p-4 sm:max-w-xs">
          <Field label="Status">
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No trips." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr>
            <Th>Code</Th><Th>Route</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Cargo</Th>
            <Th>CO₂ (kg)</Th><Th>Status</Th>{canWrite && <Th>Actions</Th>}
          </tr></thead>
          <tbody>
            {data.data.map((t) => (
              <tr key={t.id}>
                <Td className="font-medium">{t.code}</Td>
                <Td>{t.source} → {t.destination}</Td>
                <Td>{t.vehicle?.registrationNumber ?? '—'}</Td>
                <Td>{t.driver?.name ?? '—'}</Td>
                <Td>{fmtNum(t.cargoWeightKg)} kg</Td>
                <Td>{t.co2Kg != null ? fmtNum(t.co2Kg, 1) : '—'}</Td>
                <Td><Badge tone={statusTone(t.status)}>{t.status}</Badge></Td>
                {canWrite && (
                  <Td className="space-x-2 whitespace-nowrap">
                    {t.status === 'DRAFT' && <Button onClick={() => act(t.id, 'dispatch')}>Dispatch</Button>}
                    {t.status === 'DISPATCHED' && <Button onClick={() => setCompleting(t)}>Complete</Button>}
                    {(t.status === 'DRAFT' || t.status === 'DISPATCHED') && (
                      <Button variant="destructive" onClick={() => act(t.id, 'cancel')}>Cancel</Button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {completing && (
        <CompleteTripModal trip={completing} onClose={() => setCompleting(null)} onDone={() => { setCompleting(null); reload(); }} />
      )}
    </div>
  );
}

function CompleteTripModal({ trip, onClose, onDone }: { trip: Trip; onClose: () => void; onDone: () => void }) {
  const [endOdometerKm, setEnd] = useState('');
  const [fuelUsedL, setFuel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.post(`/trips/${trip.id}/complete`, {
        endOdometerKm: Number(endOdometerKm),
        fuelUsedL: fuelUsedL ? Number(fuelUsedL) : undefined,
      });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Complete ${trip.code}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">Start odometer: {fmtNum(trip.startOdometerKm ?? 0)} km · dispatched {fmtDate(trip.dispatchedAt)}</p>
        <Field label="End odometer (km)"><Input type="number" step="any" value={endOdometerKm} onChange={(e) => setEnd(e.target.value)} required /></Field>
        <Field label="Fuel used (L) — leave blank for EV / no fuel"><Input type="number" step="any" value={fuelUsedL} onChange={(e) => setFuel(e.target.value)} /></Field>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Completing…' : 'Complete trip'}</Button>
        </div>
      </form>
    </Modal>
  );
}
