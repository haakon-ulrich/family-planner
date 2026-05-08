import { Hono } from 'hono';
import { log } from '@server/logger';

const SIDECAR_URL = process.env.MOWER_SIDECAR_URL ?? 'http://localhost:3003';

const app = new Hono();

const offline = () => ({
  error: { code: 'MOWER_OFFLINE', message: 'Mower sidecar is unreachable' },
});

async function proxyGet(path: string): Promise<{ body: unknown; status: number }> {
  const res = await fetch(`${SIDECAR_URL}${path}`);
  const body: unknown = await res.json();
  return { body, status: res.status };
}

app.get('/status', async (c) => {
  try {
    const { body, status } = await proxyGet('/status');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Mower sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/health', async (c) => {
  try {
    const { body, status } = await proxyGet('/health');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Mower sidecar unreachable');
    return c.json(offline(), 503);
  }
});

export default app;
