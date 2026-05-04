import { Hono } from 'hono';
import { log } from '@server/logger';
import { broadcast } from '@server/sse';

const SIDECAR_URL = process.env.VACUUM_SIDECAR_URL ?? 'http://localhost:3001';

const app = new Hono();

const offline = () => ({
  error: { code: 'VACUUM_OFFLINE', message: 'Vacuum sidecar is unreachable' },
});

async function proxyGet(path: string): Promise<{ body: unknown; status: number }> {
  const res = await fetch(`${SIDECAR_URL}${path}`);
  const body: unknown = await res.json();
  return { body, status: res.status };
}

async function proxyPost(path: string, payload?: unknown): Promise<{ body: unknown; status: number }> {
  const res = await fetch(`${SIDECAR_URL}${path}`, {
    method: 'POST',
    headers: payload !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body: unknown = await res.json();
  return { body, status: res.status };
}

async function broadcastVacuumState(): Promise<void> {
  try {
    const { body, status } = await proxyGet('/status');
    if (status === 200 && body !== null && typeof body === 'object' && 'data' in body) {
      const data = (body as { data: { state: string; battery: number | null } }).data;
      broadcast({ type: 'vacuum-state-changed', payload: { state: data.state, battery: data.battery } });
    }
  } catch {
    // Non-fatal — clients will pick up the new state on their next poll.
  }
}

app.get('/status', async (c) => {
  try {
    const { body, status } = await proxyGet('/status');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/rooms', async (c) => {
  try {
    const { body, status } = await proxyGet('/rooms');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/clean', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON' } }, 400);
  }
  try {
    const { body, status } = await proxyPost('/clean', payload);
    if (status >= 200 && status < 300) void broadcastVacuumState();
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/dock', async (c) => {
  try {
    const { body, status } = await proxyPost('/dock');
    if (status >= 200 && status < 300) void broadcastVacuumState();
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/stop', async (c) => {
  try {
    const { body, status } = await proxyPost('/stop');
    if (status >= 200 && status < 300) void broadcastVacuumState();
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/map', async (c) => {
  try {
    const { body, status } = await proxyGet('/map');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Vacuum sidecar unreachable');
    return c.json(offline(), 503);
  }
});

export default app;
