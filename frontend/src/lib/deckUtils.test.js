import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parsePlayers, computeGameScore } from './deckUtils';
import { fetchDailyDeck } from './fetchDeck';

describe('parsePlayers', () => {
  it('parses array of pairs into flat player list', () => {
    const pairs = [
      { player_left: { PLAYER_ID: 1, PLAYER_NAME: 'A' }, player_right: { PLAYER_ID: 2, PLAYER_NAME: 'B' } },
      { player_left: { PLAYER_ID: 3, PLAYER_NAME: 'C' }, player_right: { PLAYER_ID: 4, PLAYER_NAME: 'D' } },
    ];
    expect(parsePlayers(pairs)).toHaveLength(4);
    expect(parsePlayers(pairs).map((p) => p.PLAYER_NAME)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('handles object with pairs property (API error format)', () => {
    const data = { message: 'No games', pairs: [] };
    expect(parsePlayers(data)).toEqual([]);
  });

  it('handles object with pairs containing players', () => {
    const data = {
      pairs: [
        { player_left: { PLAYER_ID: 1, PLAYER_NAME: 'X' }, player_right: { PLAYER_ID: 2, PLAYER_NAME: 'Y' } },
      ],
    };
    expect(parsePlayers(data)).toHaveLength(2);
  });

  it('filters out null/undefined players', () => {
    const pairs = [
      { player_left: { PLAYER_ID: 1, PLAYER_NAME: 'A' }, player_right: null },
      { player_left: null, player_right: { PLAYER_ID: 2, PLAYER_NAME: 'B' } },
    ];
    expect(parsePlayers(pairs)).toHaveLength(2);
  });

  it('returns empty array for null/undefined input', () => {
    expect(parsePlayers(null)).toEqual([]);
    expect(parsePlayers(undefined)).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(parsePlayers([])).toEqual([]);
  });

  it('parses API response with MAX_PLAYERS cap (regression: 118 players)', () => {
    const MAX_PLAYERS = 36;
    const pairs = Array.from({ length: MAX_PLAYERS / 2 }, (_, i) => ({
      player_left: { PLAYER_ID: i * 2, PLAYER_NAME: `P${i * 2}` },
      player_right: { PLAYER_ID: i * 2 + 1, PLAYER_NAME: `P${i * 2 + 1}` },
    }));
    const players = parsePlayers(pairs);
    expect(players).toHaveLength(MAX_PLAYERS);
    expect(players.length).toBeLessThanOrEqual(36);
  });
});

describe('computeGameScore', () => {
  it('computes game score correctly', () => {
    const p = { PTS: 20, REB: 5, AST: 5, STL: 1, BLK: 0, TOV: 2 };
    expect(computeGameScore(p)).toBeCloseTo(20 + 5 * 1.2 + 5 * 1.5 + 2 - 2 * 1.5);
  });

  it('handles missing STL/BLK/TOV', () => {
    const p = { PTS: 10, REB: 0, AST: 0 };
    expect(computeGameScore(p)).toBe(10);
  });
});

describe('fetchDailyDeck', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when server returns HTML instead of JSON (regression: Unexpected token)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<!doctype html><html>...</html>'),
    });

    await expect(fetchDailyDeck('/api/daily-deck')).rejects.toThrow(
      'Invalid response: server returned HTML instead of JSON'
    );
  });

  it('parses valid JSON array', async () => {
    const pairs = [
      { player_left: { PLAYER_ID: 1, PLAYER_NAME: 'A' }, player_right: { PLAYER_ID: 2, PLAYER_NAME: 'B' } },
    ];
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(pairs)),
    });

    const result = await fetchDailyDeck('/api/daily-deck');
    expect(result).toEqual(pairs);
  });

  it('parses valid JSON object with pairs', async () => {
    const data = { message: 'OK', pairs: [] };
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
    });

    const result = await fetchDailyDeck('/api/daily-deck');
    expect(result).toEqual(data);
  });

  it('throws on non-OK response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchDailyDeck('/api/daily-deck')).rejects.toThrow('API returned 404');
  });
});
