import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, Driver, LicenseCategory } from '@/lib/types';
import {
  PageHeader, Button, Card, Table, Th, Td, Badge, statusTone, Loading, ErrorBox, EmptyState,
  Modal, Field, Input, Select,
} from '@/components/ui';
import { fmtDate, daysUntil } from '@/lib/utils';

const CATS: LicenseCategory[] = ['LMV', 'HMV', 'TRANS'];
const STATUSES = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED'];

export function DriversPage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'SAFETY_OFFICER';
  const [statusF, setStatusF] = useState('');
  const [modal, setModal] = useState(false);

  const qs = new URLSearchParams({ limit: '100' });
  if (statusF) qs.set('status', statusF);
  const { data, loading, error, reload } = useApiGet<Paginated<Driver>>(`/drivers?${qs.toString()}`, [statusF]);

  async function setStatus(d: Driver, status: string) {
    try { await api.put(`/drivers/${d.id}`, { status }); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle="License compliance and safety scores"
        actions={canWrite ? <Button onClick={() => setModal(true)}>Add Driver</Button> : undefined}
      />
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
      {data && data.data.length === 0 && <EmptyState message="No drivers." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr>
            <Th>Name</Th><Th>License</Th><Th>Category</Th><Th>Expiry</Th><Th>Safety</Th><Th>Status</Th>{canWrite && <Th>Actions</Th>}
          </tr></thead>
          <tbody>
            {data.data.map((d) => {
              const days = daysUntil(d.licenseExpiryDate);
              return (
                <tr key={d.id}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td>{d.licenseNumber}</Td>
                  <Td>{d.licenseCategory}</Td>
                  <Td>
                    {fmtDate(d.licenseExpiryDate)}{' '}
                    {days < 0 ? <Badge tone="red">expired</Badge> : days <= 30 ? <Badge tone="red">{days}d</Badge> : days <= 90 ? <Badge tone="amber">{days}d</Badge> : null}
                  </Td>
                  <Td>{d.safetyScore}</Td>
                  <Td><Badge tone={statusTone(d.status)}>{d.status}</Badge></Td>
                  {canWrite && (
                    <Td className="space-x-2">
                      {d.status === 'SUSPENDED'
                        ? <Button variant="outline" onClick={() => setStatus(d, 'AVAILABLE')}>Reinstate</Button>
                        : d.status !== 'ON_TRIP' && <Button variant="destructive" onClick={() => setStatus(d, 'SUSPENDED')}>Suspend</Button>}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {modal && <CreateDriverModal onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />}
    </div>
  );
}

function CreateDriverModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', licenseNumber: '', licenseCategory: 'LMV', licenseExpiryDate: '', contactNumber: '', safetyScore: '80' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.post('/drivers', {
        name: form.name, licenseNumber: form.licenseNumber, licenseCategory: form.licenseCategory,
        licenseExpiryDate: form.licenseExpiryDate, contactNumber: form.contactNumber || undefined,
        safetyScore: form.safetyScore ? Number(form.safetyScore) : undefined,
      });
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add Driver">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="License number"><Input value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} required /></Field>
          <Field label="Category"><Select value={form.licenseCategory} onChange={(e) => set('licenseCategory', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="License expiry"><Input type="date" value={form.licenseExpiryDate} onChange={(e) => set('licenseExpiryDate', e.target.value)} required /></Field>
          <Field label="Safety score"><Input type="number" min="0" max="100" value={form.safetyScore} onChange={(e) => set('safetyScore', e.target.value)} /></Field>
        </div>
        <Field label="Contact number"><Input value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} /></Field>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}
