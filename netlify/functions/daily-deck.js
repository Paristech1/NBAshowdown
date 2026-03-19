/**
 * Netlify serverless function: /api/daily-deck
 * Fetches NBA box scores from cdn.nba.com and returns player pairs for the showdown game.
 */

const NBA_CDN_BASE = "https://cdn.nba.com/static/json";
const SCOREBOARD_URL = `${NBA_CDN_BASE}/liveData/scoreboard/todaysScoreboard_00.json`;
const BOXSCORE_URL = (gameId) => `${NBA_CDN_BASE}/liveData/boxscore/boxscore_${gameId}.json`;
const SCHEDULE_URL = `${NBA_CDN_BASE}/staticData/scheduleLeagueV2.json`;

const DAYS_LOOKBACK = 7;
const TOP_PLAYERS_PER_TEAM = 6;
const MAX_PLAYERS = 36; // Cap deck to ~36 players (35 picks to win)
const MIN_PLAYERS = 4; // Require at least 4 players (2 pairs) for a valid game
const HTTP_TIMEOUT = 15000;

/** Game Score: PTS + REB*1.2 + AST*1.5 + STL*2 + BLK*2 - TOV*1.5 (matches frontend) */
function gameScore(p) {
  return p.PTS + p.REB * 1.2 + p.AST * 1.5 + (p.STL ?? 0) * 2 + (p.BLK ?? 0) * 2 - (p.TOV ?? 0) * 1.5;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT) });
  if (!res.ok) throw new Error(`NBA CDN returned ${res.status}`);
  return res.json();
}

function getSchedule() {
  return fetchJson(SCHEDULE_URL).then((data) => {
    const dates = data?.leagueSchedule?.gameDates ?? [];
    return Array.isArray(dates) ? dates : [];
  }).catch((e) => {
    console.error("Error fetching schedule:", e.message);
    return [];
  });
}

function getGamesForDate(gameDates, targetDateStr) {
  const targetNorm = targetDateStr; // MM/DD/YYYY
  for (const gd of gameDates) {
    const raw = gd?.gameDate ?? "";
    const gdDate = raw.includes(" ") ? raw.split(" ")[0] : raw;
    if (gdDate === targetNorm) {
      const games = gd?.games ?? [];
      const finished = games.filter((g) => g?.gameStatus === 3);
      return finished.map((g) => g.gameId);
    }
  }
  return [];
}

async function getTodayScoreboardGameIds() {
  try {
    const data = await fetchJson(SCOREBOARD_URL);
    const games = data?.scoreboard?.games ?? [];
    const finalGames = games.filter((g) => g?.gameStatus === 3);
    return finalGames.map((g) => g.gameId);
  } catch (e) {
    console.error("Error fetching scoreboard:", e.message);
    return [];
  }
}

function getTargetDate(gameDates) {
  const today = new Date();

  // Check today's scoreboard first (handled in handler)
  for (let d = 0; d <= DAYS_LOOKBACK; d++) {
    const check = new Date(today);
    check.setDate(check.getDate() - d);
    const dateStr = formatDateMMDDYYYY(check);
    const ids = getGamesForDate(gameDates, dateStr);
    if (ids.length > 0) return dateStr;
  }
  const fallback = new Date(today);
  fallback.setDate(fallback.getDate() - 1);
  return formatDateMMDDYYYY(fallback);
}

function formatDateMMDDYYYY(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function parseMinutes(minutes) {
  if (!minutes || minutes === "00:00") return null;
  if (minutes.startsWith("PT")) {
    const m = minutes.replace("PT", "").replace("M", ":").replace("S", "").replace(/\.\d+$/, "");
    const parts = m.split(":");
    if (parts.length >= 2) {
      return `${parseInt(parts[0], 10)}:${String(parseInt(parts[1], 10)).padStart(2, "0")}`;
    }
  }
  return minutes;
}

async function fetchBoxScore(gameId) {
  const players = [];
  try {
    const data = await fetchJson(BOXSCORE_URL(gameId));
    const game = data?.game;
    if (!game) return players;

    for (const teamKey of ["homeTeam", "awayTeam"]) {
      const team = game[teamKey] ?? {};
      const teamId = team.teamId ?? 0;
      const teamAbbr = team.teamTricode ?? "???";

      const teamPlayers = [];
      for (const p of team.players ?? []) {
        const stats = p.statistics ?? {};
        const minutes = stats.minutes ?? "";
        const minStr = parseMinutes(minutes);
        if (!minStr || minutes.startsWith("PT00M")) continue;

        const pts = parseInt(stats.points ?? 0, 10);
        const reb = parseInt(stats.reboundsTotal ?? 0, 10);
        const ast = parseInt(stats.assists ?? 0, 10);
        const composite = pts + reb * 1.2 + ast * 1.5;

        const fga = parseInt(stats.fieldGoalsAttempted ?? 0, 10);
        const fgm = parseInt(stats.fieldGoalsMade ?? 0, 10);
        const fgPct = fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : 0;

        const tpa = parseInt(stats.threePointersAttempted ?? 0, 10);
        const tpm = parseInt(stats.threePointersMade ?? 0, 10);
        const tpPct = tpa > 0 ? Math.round((tpm / tpa) * 1000) / 10 : 0;

        const fta = parseInt(stats.freeThrowsAttempted ?? 0, 10);
        const ftm = parseInt(stats.freeThrowsMade ?? 0, 10);
        const ftPct = fta > 0 ? Math.round((ftm / fta) * 1000) / 10 : 0;

        teamPlayers.push({
          PLAYER_ID: p.personId ?? 0,
          PLAYER_NAME: `${p.firstName ?? ""} ${p.familyName ?? ""}`.trim(),
          TEAM_ID: teamId,
          TEAM_ABBREVIATION: teamAbbr,
          PTS: pts,
          REB: reb,
          AST: ast,
          STL: parseInt(stats.steals ?? 0, 10),
          BLK: parseInt(stats.blocks ?? 0, 10),
          TOV: parseInt(stats.turnovers ?? 0, 10),
          FG_PCT: fgPct,
          TP_PCT: tpPct,
          FT_PCT: ftPct,
          PLUS_MINUS: parseFloat(stats.plusMinusPoints ?? 0),
          MIN: minStr,
          _composite: composite,
        });
      }

      const top = teamPlayers.sort((a, b) => b._composite - a._composite).slice(0, TOP_PLAYERS_PER_TEAM);
      for (const p of top) {
        delete p._composite;
        players.push(p);
      }
    }
  } catch (e) {
    console.error(`Error fetching box score ${gameId}:`, e.message);
  }
  return players;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  let targetDateStr;

  if (dateParam) {
    try {
      const parsed = new Date(dateParam + "T12:00:00");
      if (isNaN(parsed.getTime())) throw new Error("Invalid");
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      const y = parsed.getFullYear();
      targetDateStr = `${m}/${d}/${y}`;
    } catch {
      return new Response(
        JSON.stringify({ message: "Invalid date format. Use YYYY-MM-DD.", pairs: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    const gameDates = await getSchedule();
    const idsToday = await getTodayScoreboardGameIds();
    if (idsToday.length > 0) {
      targetDateStr = formatDateMMDDYYYY(new Date());
    } else {
      targetDateStr = getTargetDate(gameDates);
    }
  }

  const gameDates = await getSchedule();
  let gameIds = getGamesForDate(gameDates, targetDateStr);
  if (gameIds.length === 0) {
    gameIds = await getTodayScoreboardGameIds();
  }

  if (gameIds.length === 0) {
    return new Response(
      JSON.stringify({ message: `No completed games found for ${targetDateStr}.`, pairs: [] }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const playerPool = [];
  await Promise.all(
    gameIds.map(async (gid) => {
      const players = await fetchBoxScore(gid);
      playerPool.push(...players);
    })
  );

  // Select top MAX_PLAYERS by Game Score (best performers)
  const ranked = playerPool
    .map((p) => ({ ...p, _gs: gameScore(p) }))
    .sort((a, b) => b._gs - a._gs)
    .slice(0, MAX_PLAYERS)
    .map(({ _gs, ...p }) => p);

  if (ranked.length < MIN_PLAYERS) {
    return new Response(
      JSON.stringify({ message: `Not enough players (${ranked.length}). Need at least ${MIN_PLAYERS}.`, pairs: [] }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const shuffled = shuffle(ranked);
  const pairs = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push({
      id: i,
      player_left: shuffled[i],
      player_right: shuffled[i + 1],
    });
  }

  return new Response(JSON.stringify(pairs), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
