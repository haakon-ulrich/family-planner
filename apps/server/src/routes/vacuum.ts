import { Hono } from 'hono';
import { log } from '@server/logger';

const SIDECAR_URL = process.env.VACUUM_SIDECAR_URL ?? 'http://localhost:3001';

const app = new Hono();

app.get('/status', async (c) => {
  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}/status`);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json({ error: { code: 'VACUUM_OFFLINE', message: 'Vacuum sidecar is unreachable' } }, 503);
  }

  const body: unknown = await res.json();
  return c.json(body, res.status as 200);
});

export default app;
