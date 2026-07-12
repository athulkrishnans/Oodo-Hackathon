import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { useApiGet } from '@/lib/useApi';
import type { Wrapped } from '@/lib/types';
import { PageHeader, Card, CardBody, Button, Table, Th, Td, Loading, ErrorBox } from '@/components/ui';
import { fmtNum } from '@/lib/utils';

interface FuelEff { vehicles: { registrationNumber: string; avgKmPerLiter: number | null }[]; fleetAverage: number | null; worst5: { registrationNumber: string; avgKmPerLiter: number }[] }
interface OpCost { perVehicle: { registrationNumber: string; fuel: number; maintenance: number; expenses: number; total: number }[]; monthly: { month: string; fuel: number; maintenance: number; expenses: number }[] }
interface Roi { perVehicle: { registrationNumber: string; revenue: number; fuel: number; maintenance: number; acquisitionCost: number; roi: number | null }[] }
interface Carbon { perVehicle: { registrationNumber: string; co2Kg: number }[]; monthly: { month: string; co2Kg: number }[]; fleetTotal: number }
interface Util { currentUtilization: number; onTrip: number; nonRetired: number; trend: { date: string; utilization: number }[] }

async function downloadCsv(name: string) {
  const token = localStorage.getItem('transitops_token');
  const res = await fetch(`/api/v1/reports/${name}/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}-report.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const fuel = useApiGet<Wrapped<FuelEff>>('/reports/fuel-efficiency');
  const cost = useApiGet<Wrapped<OpCost>>('/reports/operational-cost');
  const roi = useApiGet<Wrapped<Roi>>('/reports/roi');
  const carbon = useApiGet<Wrapped<Carbon>>('/reports/carbon');
  const util = useApiGet<Wrapped<Util>>('/reports/utilization');

  const anyLoading = fuel.loading || cost.loading || roi.loading || carbon.loading || util.loading;
  const anyError = fuel.error || cost.error || roi.error || carbon.error || util.error;

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Fuel efficiency, utilization, cost, ROI and carbon" />
      {anyLoading && <Loading />}
      {anyError && <ErrorBox message={anyError.message} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Fuel efficiency */}
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Fuel Efficiency (km/L)</h2>
              <Button variant="outline" onClick={() => downloadCsv('fuel-efficiency')}>Export CSV</Button>
            </div>
            {fuel.data && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">Fleet average: {fmtNum(fuel.data.data.fleetAverage, 1)} km/L</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={fuel.data.data.vehicles.filter((v) => v.avgKmPerLiter != null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="registrationNumber" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                    <Bar dataKey="avgKmPerLiter" fill="#2563eb" name="km/L" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardBody>
        </Card>

        {/* Utilization trend */}
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Utilization (30-day trend)</h2>
              <Button variant="outline" onClick={() => downloadCsv('utilization')}>Export CSV</Button>
            </div>
            {util.data && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">Current: {(util.data.data.currentUtilization * 100).toFixed(0)}% ({util.data.data.onTrip}/{util.data.data.nonRetired} on trip)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={util.data.data.trend.map((t) => ({ ...t, pct: Math.round(t.utilization * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} hide /><YAxis fontSize={11} /><Tooltip />
                    <Line type="monotone" dataKey="pct" stroke="#16a34a" name="Utilization %" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </CardBody>
        </Card>

        {/* Operational cost monthly */}
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Operational Cost (monthly)</h2>
              <Button variant="outline" onClick={() => downloadCsv('operational-cost')}>Export CSV</Button>
            </div>
            {cost.data && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cost.data.data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
                  <Bar dataKey="fuel" stackId="a" fill="#2563eb" name="Fuel" />
                  <Bar dataKey="maintenance" stackId="a" fill="#f59e0b" name="Maintenance" />
                  <Bar dataKey="expenses" stackId="a" fill="#ef4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* CO2 by vehicle */}
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">CO₂ by Vehicle (kg)</h2>
              <Button variant="outline" onClick={() => downloadCsv('carbon')}>Export CSV</Button>
            </div>
            {carbon.data && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">Fleet total: {fmtNum(carbon.data.data.fleetTotal, 1)} kg CO₂</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={carbon.data.data.perVehicle.filter((v) => v.co2Kg > 0)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="registrationNumber" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                    <Bar dataKey="co2Kg" fill="#64748b" name="kg CO₂" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ROI table */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Vehicle ROI</h2>
          <Button variant="outline" onClick={() => downloadCsv('roi')}>Export CSV</Button>
        </div>
        {roi.data && (
          <Table>
            <thead><tr><Th>Vehicle</Th><Th>Revenue</Th><Th>Fuel</Th><Th>Maintenance</Th><Th>Acquisition</Th><Th>ROI</Th></tr></thead>
            <tbody>
              {roi.data.data.perVehicle.map((r) => (
                <tr key={r.registrationNumber}>
                  <Td className="font-medium">{r.registrationNumber}</Td>
                  <Td>{fmtNum(r.revenue)}</Td>
                  <Td>{fmtNum(r.fuel)}</Td>
                  <Td>{fmtNum(r.maintenance)}</Td>
                  <Td>{fmtNum(r.acquisitionCost)}</Td>
                  <Td className={r.roi != null && r.roi >= 0 ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                    {r.roi != null ? `${(r.roi * 100).toFixed(1)}%` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
