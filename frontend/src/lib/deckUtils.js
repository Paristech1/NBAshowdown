/**
 * Deck parsing and game logic utilities.
 * Extracted for testability.
 */

export function parsePlayers(data) {
  const players = [];
  const pairs = Array.isArray(data) ? data : (data?.pairs ?? []);
  for (const pair of pairs) {
    if (pair?.player_left) players.push(pair.player_left);
    if (pair?.player_right) players.push(pair.player_right);
  }
  return players.filter(Boolean);
}

export function computeGameScore(p) {
  return +(
    p.PTS +
    p.REB * 1.2 +
    p.AST * 1.5 +
    (p.STL ?? 0) * 2 +
    (p.BLK ?? 0) * 2 -
    (p.TOV ?? 0) * 1.5
  ).toFixed(1);
}
