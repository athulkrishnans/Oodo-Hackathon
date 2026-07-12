import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, Expense, Vehicle, ExpenseType } from '@/lib/types';
import {
  PageHeader, Button, Table, Th, Td, Loading, ErrorBox, EmptyState, Modal, Field, Input, Select, Textarea,
} from '@/components/ui';
import { fmtDate, fmtNum } from '@/lib/utils';

const TYPES: ExpenseType[] = ['TOLL', 'PARKING', 'FINE', 'OTHER'];

export function ExpensesPage() {
  const { role } = useAuth();
  const canWrite = role === 'ADMIN' || role === 'FINANCIAL_ANALYST';
  const [modal, setModal] = useState(false);
  const { data, loading, error, reload } = useApiGet<Paginated<Expense>>('/expenses?limit=100');
  const vehicles = useApiGet<Paginated<Vehicle>>('/vehicles?limit=100');

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Tolls, parking, fines and other operational costs"
        actions={canWrite ? <Button onClick={() => setModal(true)}>Add Expense</Button> : undefined} />

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No expenses." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr><Th>Date</Th><Th>Vehicle</Th><Th>Type</Th><Th>Amount</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {data.data.map((x) => (
              <tr key={x.id}>
                <Td>{fmtDate(x.date)}</Td>
                <Td>{x.vehicle?.registrationNumber ?? x.vehicleId.slice(0, 8)}</Td>
                <Td>{x.type}</Td>
                <Td>{fmtNum(x.amount)}</Td>
                <Td>{x.notes ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {modal && (
        <CreateExpenseModal vehicles={vehicles.data?.data ?? []} onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} />
      )}
    </div>
  );
}

function CreateExpenseModal({ vehicles, onClose, onCreated }: { vehicles: Vehicle[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ vehicleId: '', type: 'TOLL', amount: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.post('/expenses', { vehicleId: form.vehicleId, type: form.type, amount: Number(form.amount), notes: form.notes || undefined });
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add Expense">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Vehicle">
          <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Amount"><Input type="number" step="any" value={form.amount} onChange={(e) => set('amount', e.target.value)} required /></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}
