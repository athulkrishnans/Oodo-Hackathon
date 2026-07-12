import { useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import { useAuth } from '@/auth/AuthContext';
import type { Paginated, FuelLog } from '@/lib/types';
import {
  PageHeader, Button, Table, Th, Td, Badge, Loading, ErrorBox, EmptyState, Modal, Field, Textarea,
} from '@/components/ui';
import { fmtDate, fmtNum } from '@/lib/utils';

export function AnomaliesPage() {
  const { role } = useAuth();
  const canReview = role === 'ADMIN' || role === 'FINANCIAL_ANALYST';
  const [reviewing, setReviewing] = useState<FuelLog | null>(null);
  const { data, loading, error, reload } = useApiGet<Paginated<FuelLog>>('/fuel-logs/anomalies?limit=100');

  return (
    <div>
      <PageHeader title="Fuel Anomalies" subtitle="Suspicious fuel logs — expected vs actual shown for explainability" />

      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No anomalies flagged. 🎉" />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr>
            <Th>Date</Th><Th>Vehicle</Th><Th>Actual (L)</Th><Th>Expected (L)</Th><Th>Deviation</Th><Th>Status</Th>{canReview && <Th>Actions</Th>}
          </tr></thead>
          <tbody>
            {data.data.map((f) => (
              <tr key={f.id}>
                <Td>{fmtDate(f.date)}</Td>
                <Td>{f.vehicle?.registrationNumber ?? f.vehicleId.slice(0, 8)}</Td>
                <Td className="font-medium text-red-700">{fmtNum(f.liters, 1)}</Td>
                <Td>{f.expectedLiters != null ? fmtNum(f.expectedLiters, 1) : '—'}</Td>
                <Td>{f.deviationPct != null ? `+${(f.deviationPct * 100).toFixed(0)}%` : '—'}</Td>
                <Td>{f.anomalyReviewed ? <Badge tone="amber">reviewed</Badge> : <Badge tone="red">unreviewed</Badge>}</Td>
                {canReview && <Td>{!f.anomalyReviewed && <Button variant="outline" onClick={() => setReviewing(f)}>Review</Button>}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {reviewing && (
        <ReviewModal log={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); reload(); }} />
      )}
    </div>
  );
}

function ReviewModal({ log, onClose, onDone }: { log: FuelLog; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.post(`/fuel-logs/${log.id}/review`, { reviewNote: note }); onDone(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Review Anomaly">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {fmtNum(log.liters, 1)} L logged vs {log.expectedLiters != null ? fmtNum(log.expectedLiters, 1) : '—'} L expected.
          Marking as reviewed keeps the flag and records your note (evidence is never deleted).
        </p>
        <Field label="Justification note"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} required /></Field>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark reviewed'}</Button>
        </div>
      </form>
    </Modal>
  );
}
