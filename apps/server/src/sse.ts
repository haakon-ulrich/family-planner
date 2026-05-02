import type { SSEStreamingApi } from 'hono/streaming';
import type { SseEvent } from '@shared/index';

const clients = new Set<SSEStreamingApi>();

export const addClient = (stream: SSEStreamingApi): void => {
  clients.add(stream);
};

export const removeClient = (stream: SSEStreamingApi): void => {
  clients.delete(stream);
};

export const broadcast = (event: SseEvent): void => {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.aborted) {
      clients.delete(client);
      continue;
    }
    client.writeSSE({ data }).catch(() => clients.delete(client));
  }
};
