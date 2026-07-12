// scripts/loadtest.k6.js
// Section 14, Innovation #7 — k6 load test.
// Target: 200 VUs, login + dashboard flow, p95 < 300ms.
// Results chart committed to README.
// Run: k6 run scripts/loadtest.k6.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 200,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';

export function setup() {
  // TODO: login as DISPATCHER, return token for use in default function
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'dispatcher@transitops.dev',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'login 200': (r) => r.status === 200 });
  return { token: res.json('data.accessToken') };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Flow: GET /vehicles (dashboard KPI source)
  const vehiclesRes = http.get(`${BASE_URL}/vehicles?page=1&limit=20`, { headers });
  check(vehiclesRes, { 'vehicles 200': (r) => r.status === 200 });

  // GET /trips?status=DISPATCHED
  const tripsRes = http.get(`${BASE_URL}/trips?status=DISPATCHED&page=1&limit=20`, { headers });
  check(tripsRes, { 'trips 200': (r) => r.status === 200 });

  sleep(1);
}
