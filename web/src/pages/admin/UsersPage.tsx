import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import type { Paginated, User, Role } from '@/lib/types';
import { ALL_ROLES } from '@/lib/types';
import { PageHeader, Table, Th, Td, Badge, statusTone, Loading, ErrorBox, EmptyState, Select, Button } from '@/components/ui';
import { fmtDate } from '@/lib/utils';

export function UsersPage() {
  const { data, loading, error, reload } = useApiGet<Paginated<User>>('/users?limit=100');

  async function assignRole(id: string, role: Role) {
    try { await api.patch(`/users/${id}/role`, { role }); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : 'Failed'); }
  }
  async function toggleStatus(u: User) {
    try { await api.patch(`/users/${u.id}/status`, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Approve pending signups by assigning a role" />
      {loading && <Loading />}
      {error && <ErrorBox message={error.message} />}
      {data && data.data.length === 0 && <EmptyState message="No users." />}
      {data && data.data.length > 0 && (
        <Table>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {data.data.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">{u.name}</Td>
                <Td>{u.email}</Td>
                <Td>{u.role ? <Badge tone="blue">{u.role}</Badge> : <Badge tone="amber">pending</Badge>}</Td>
                <Td><Badge tone={statusTone(u.status)}>{u.status}</Badge></Td>
                <Td>{fmtDate(u.createdAt)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-40"
                      value={u.role ?? ''}
                      onChange={(e) => e.target.value && assignRole(u.id, e.target.value as Role)}
                    >
                      <option value="">Assign role…</option>
                      {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                    <Button variant="outline" onClick={() => toggleStatus(u)}>
                      {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
