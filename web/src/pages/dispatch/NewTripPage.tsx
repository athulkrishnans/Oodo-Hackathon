import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { useApiGet } from '@/lib/useApi';
import type { Paginated, Vehicle, Driver, RecommendationResult, Wrapped, Trip } from '@/lib/types';
import {
  PageHeader, Button, Card, CardBody, Field, Input, Select, Badge, ErrorBox, Spinner,
} from '@/components/ui';
import { fmtNum } from '@/lib/utils';

export function NewTripPage() {
  const navigate = useNavigate();
  const vehicles = useApiGet<Paginated<Vehicle>>('/vehicles?status=AVAILABLE&limit=100');
  const drivers = useApiGet<Paginated<Driver>>('/drivers?status=AVAILABLE&limit=100');

  const [form, setForm] = useState({ source: '', destination: '', cargoWeightKg: '', plannedDistanceKm: '', revenue: '', vehicleId: '', driverId: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [recs, setRecs] = useState<RecommendationResult | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Trip | null>(null);

  async function findRecs() {
    setError(null);
    if (!form.cargoWeightKg || !form.plannedDistanceKm) { setError('Enter cargo weight and planned distance first.'); return; }
    setRecLoading(true);
    try {
      const res = await api.get<Wrapped<RecommendationResult>>(
        `/trips/recommendations?cargoWeightKg=${form.cargoWeightKg}&plannedDistanceKm=${form.plannedDistanceKm}`,
      );
      setRecs(res.data);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to fetch recommendations'); }
    finally { setRecLoading(false); }
  }

  async function createTrip(dispatch: boolean) {
    setError(null); setBusy(true);
    try {
      const res = await api.post<Wrapped<Trip>>('/trips', {
        source: form.source, destination: form.destination,
        vehicleId: form.vehicleId, driverId: form.driverId,
        cargoWeightKg: Number(form.cargoWeightKg), plannedDistanceKm: Number(form.plannedDistanceKm),
        revenue: form.revenue ? Number(form.revenue) : undefined,
      });
      if (dispatch) {
        await api.post(`/trips/${res.data.id}/dispatch`, {}, { 'Idempotency-Key': `dispatch-${res.data.id}` });
        navigate('/dispatch/trips');
        return;
      }
      setCreated(res.data);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to create trip'); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="New Trip" subtitle="Smart recommendations rank eligible vehicle + driver pairs" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source"><Input value={form.source} onChange={(e) => set('source', e.target.value)} /></Field>
              <Field label="Destination"><Input value={form.destination} onChange={(e) => set('destination', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cargo weight (kg)"><Input type="number" step="any" value={form.cargoWeightKg} onChange={(e) => set('cargoWeightKg', e.target.value)} /></Field>
              <Field label="Planned distance (km)"><Input type="number" step="any" value={form.plannedDistanceKm} onChange={(e) => set('plannedDistanceKm', e.target.value)} /></Field>
            </div>
            <Field label="Revenue (optional)"><Input type="number" step="any" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} /></Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vehicle">
                <Select value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required>
                  <option value="">Select vehicle</option>
                  {vehicles.data?.data.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.type}</option>)}
                </Select>
              </Field>
              <Field label="Driver">
                <Select value={form.driverId} onChange={(e) => set('driverId', e.target.value)} required>
                  <option value="">Select driver</option>
                  {drivers.data?.data.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.licenseCategory}</option>)}
                </Select>
              </Field>
            </div>

            {error && <ErrorBox message={error} />}
            {created && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                Trip {created.code} created as DRAFT.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={findRecs} disabled={recLoading}>
                {recLoading ? 'Finding…' : 'Find recommendations'}
              </Button>
              <Button type="button" onClick={() => createTrip(false)} disabled={busy || !form.vehicleId || !form.driverId || !form.source || !form.destination}>
                Create draft
              </Button>
              <Button type="button" variant="secondary" onClick={() => createTrip(true)} disabled={busy || !form.vehicleId || !form.driverId || !form.source || !form.destination}>
                Create &amp; dispatch
              </Button>
            </div>
          </CardBody>
        </Card>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recommendations</h2>
          {recLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Scoring pairs…</div>}
          {recs && recs.recommendations.length === 0 && (
            <Card><CardBody><p className="text-sm text-muted-foreground">No eligible pairs for this cargo/distance.</p></CardBody></Card>
          )}
          {recs && (
            <p className="mb-2 text-xs text-muted-foreground">
              Weights — capacity {recs.weights.capacity} · fuel {recs.weights.fuel} · maintenance {recs.weights.maintenance} · safety {recs.weights.safety}
            </p>
          )}
          <div className="space-y-3">
            {recs?.recommendations.map((r, i) => (
              <Card key={`${r.vehicle.id}-${r.driver.id}`}>
                <CardBody className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{i + 1} · {r.vehicle.registrationNumber} + {r.driver.name}</span>
                    <Badge tone="blue">score {(r.score * 100).toFixed(0)}%</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge tone="gray">{(r.breakdown.capacityFit * 100).toFixed(0)}% capacity fit</Badge>
                    <Badge tone="gray">{(r.breakdown.fuelEfficiency * 100).toFixed(0)}% fuel eff.</Badge>
                    <Badge tone="gray">{(r.breakdown.maintenanceHeadroom * 100).toFixed(0)}% svc headroom</Badge>
                    <Badge tone="gray">safety {(r.breakdown.driverSafety * 100).toFixed(0)}%</Badge>
                  </div>
                  {r.serviceDueWithinDistance && <Badge tone="amber">⚠ vehicle due for service within planned distance</Badge>}
                  <div className="pt-1 text-xs text-muted-foreground">Capacity {fmtNum(r.vehicle.maxLoadCapacityKg)} kg · safety {r.driver.safetyScore}</div>
                  <Button variant="outline" onClick={() => setForm((f) => ({ ...f, vehicleId: r.vehicle.id, driverId: r.driver.id }))}>
                    Apply this pair
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
