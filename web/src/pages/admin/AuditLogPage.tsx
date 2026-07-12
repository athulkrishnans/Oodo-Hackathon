import { useApiGet } from '@/lib/useApi';
import type { Paginated, AuditLogItem } from '@/lib/types';
import { PageHeader, Table, Th, Td, Badge, Loading, ErrorBox, EmptyState } from '@/components/ui';

export function AuditLogPage() {
  const { data, loading, error } = useApiGet<Paginated<AuditLogItem>>('/audit-logs?limit=100');

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Immutable record of every state change — who did what, when" />
      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No audit entries yet." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th></tr></thead>
          <tbody>
            {data.data.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</Td>
                <Td>{a.actor?.name ?? a.actorId.slice(0, 8)}{a.actor?.role ? ` (${a.actor.role})` : ''}</Td>
                <Td><Badge tone="blue">{a.action}</Badge></Td>
                <Td>{a.entity} · {a.entityId.slice(0, 8)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
