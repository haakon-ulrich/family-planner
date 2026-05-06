import { Hono } from 'hono';
import { log } from '@server/logger';

const SIDECAR_URL = process.env.MEDIA_SIDECAR_URL ?? 'http://localhost:3002';

const app = new Hono();

const offline = () => ({
  error: { code: 'MEDIA_OFFLINE', message: 'Media sidecar is unreachable' },
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

app.get('/health', async (c) => {
  try {
    const { body, status } = await proxyGet('/health');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/artists', async (c) => {
  try {
    const { body, status } = await proxyGet('/artists');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/artists/:id/albums', async (c) => {
  const id = c.req.param('id');
  try {
    const { body, status } = await proxyGet(`/artists/${id}/albums`);
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/play', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON' } }, 400);
  }
  try {
    const { body, status } = await proxyPost('/play', payload);
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/pause', async (c) => {
  try {
    const { body, status } = await proxyPost('/pause');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/resume', async (c) => {
  try {
    const { body, status } = await proxyPost('/resume');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.post('/stop', async (c) => {
  try {
    const { body, status } = await proxyPost('/stop');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

app.get('/status', async (c) => {
  try {
    const { body, status } = await proxyGet('/status');
    return c.json(body, status as 200);
  } catch (err) {
    log.warn({ err }, 'Media sidecar unreachable');
    return c.json(offline(), 503);
  }
});

export default app;
