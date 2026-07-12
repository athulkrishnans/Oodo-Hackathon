import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errors';
import { authRateLimit } from './middleware/rateLimit';

// Module routers (stubs — implemented by each member in H1+)
import { authRouter } from './modules/auth/routes';
import { fleetRouter } from './modules/fleet/routes';
import { dispatchRouter } from './modules/dispatch/routes';
import { financeRouter } from './modules/finance/routes';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ── Global middleware ────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────
app.use('/api/v1/auth', authRateLimit, authRouter);
app.use('/api/v1', fleetRouter);
app.use('/api/v1', dispatchRouter);
app.use('/api/v1', financeRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ─────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TransitOps API running on http://localhost:${PORT}`);
});

export default app;
