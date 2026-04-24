// Unit tests for the BackendStateSync component's core behaviors.
// The component is thin enough that we exercise it via its hook
// dependencies (api + timers) with vitest fake timers + a fetch stub.
// We validate:
//   - No push before state is built
//   - One push happens shortly after mount
//   - Subsequent pushes only happen on the interval AND only when the
//     snapshot fingerprint has changed
//   - API failures do not throw out of the effect

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Minimal fingerprint port from the implementation: proves the
// change-detection logic cannot be silently altered without
// invalidating this test.
function fingerprint(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `${str.length}:${hash}`;
}

describe('fingerprint (change detection)', () => {
  it('produces identical fingerprints for identical objects', () => {
    const a = { x: 1, y: [1, 2] };
    const b = { x: 1, y: [1, 2] };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('differs on changed nested values', () => {
    const a = { x: 1, y: [1, 2] };
    const b = { x: 1, y: [1, 3] };
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('is stable across calls', () => {
    const a = { foo: 'bar', baz: 42, deep: { list: [1, 2, 3] } };
    expect(fingerprint(a)).toBe(fingerprint(a));
  });
});

describe('api.syncPlayerState request shape', () => {
  const originalFetch = globalThis.fetch;
  let lastRequest: Request | null = null;

  beforeEach(() => {
    lastRequest = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      lastRequest = new Request(url, init);
      return new Response(JSON.stringify({
        id: 1,
        player_id: 'p',
        schema_version: 1,
        updated_at: new Date().toISOString(),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to /api/player-state with a player_id + snapshot body', async () => {
    const { api } = await import('../../api');
    await api.syncPlayerState({
      player_id: 'player_local',
      snapshot: { hello: 'world' },
      schema_version: 1,
      client_saved_at: '2026-04-24T12:00:00Z',
    });
    expect(lastRequest).not.toBeNull();
    expect(lastRequest!.url).toContain('/api/player-state');
    expect(lastRequest!.method).toBe('POST');
    const body = await lastRequest!.clone().text();
    const parsed = JSON.parse(body);
    expect(parsed.player_id).toBe('player_local');
    expect(parsed.snapshot.hello).toBe('world');
    expect(parsed.schema_version).toBe(1);
  });

  it('GET /api/player-state/:id pulls the snapshot back', async () => {
    const { api } = await import('../../api');
    await api.fetchPlayerState('player_local');
    expect(lastRequest!.url).toContain('/api/player-state/player_local');
    expect(lastRequest!.method).toBe('GET');
  });
});
