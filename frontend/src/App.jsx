import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { FaBasketballBall, FaTrophy, FaShareAlt, FaLink, FaChevronDown, FaChevronUp, FaFilter, FaCalendarAlt, FaHistory } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import React from 'react';
import './App.css';

// --- Constants ---
const API_BASE = 'http://localhost:8000';
const STORAGE_KEY = 'nba_showdown_state';

const LEAGUE_AVG = {
  PTS: 15, REB: 5, AST: 5, STL: 1, BLK: 0.5, PLUS_MINUS: 0,
};

function computeGameScore(p) {
  return +(
    p.PTS +
    p.REB * 1.2 +
    p.AST * 1.5 +
    p.STL * 2 +
    p.BLK * 2 -
    p.TOV * 1.5
  ).toFixed(1);
}

function statColor(key, val) {
  const avg = LEAGUE_AVG[key];
  if (avg === undefined) return '';
  if (val > avg) return 'stat-green';
  if (val < avg) return 'stat-red';
  return '';
}

function saveToStorage(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function deriveTeams(players) {
  return [...new Set(players.map(p => p.TEAM_ABBREVIATION))].sort();
}

function parsePlayers(data) {
  const players = [];
  if (Array.isArray(data)) {
    data.forEach(pair => {
      if (pair.player_left) players.push(pair.player_left);
      if (pair.player_right) players.push(pair.player_right);
    });
  }
  return players;
}

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1040 760' fill='%23333'%3E%3Crect width='1040' height='760' fill='%23222'/%3E%3Ccircle cx='520' cy='280' r='140' fill='%23444'/%3E%3Cellipse cx='520' cy='600' rx='220' ry='180' fill='%23444'/%3E%3C/svg%3E";

// --- PlayerCard ---
const PlayerCard = ({ player, onClick, isWinner, isLoser, showFullStats, onToggleStats }) => {
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PLAYER_ID}.png`;
  const gameScore = computeGameScore(player);

  return (
    <motion.div
      className={`card-wrap pointer ${isWinner ? 'winner-card' : ''} ${isLoser ? 'loser-card' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.25, 1] }}
      layout
    >
      <div className="card">
        <img
          src={imgUrl}
          alt={player.PLAYER_NAME}
          className="card-bg"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
        />
        <div className="card-filter"></div>

        <div className="card-status">
          <div className={`status-dot ${isLoser ? 'loser-dot' : 'online'}`}></div>
          <div className="status-text">{isLoser ? "TONIGHT'S LOSER" : 'ACTIVE'}</div>
        </div>

        <div className="game-score-badge">
          <span className="gs-label">GAME SCORE</span>
          <span className="gs-value">{gameScore}</span>
        </div>

        <div className="card-content">
          <div className="card-name-wrap">
            <div className="card-name">{player.PLAYER_NAME}</div>
            <MdVerified className="card-verification" color="#3b82f6" size={20} />
          </div>
          <div className="card-team">
            <img
              src={`https://cdn.nba.com/logos/nba/${player.TEAM_ID}/primary/L/logo.svg`}
              alt={player.TEAM_ABBREVIATION}
              className="team-logo"
            />
            {player.TEAM_ABBREVIATION}
          </div>

          <div className="card-stats">
            {['PTS', 'REB', 'AST', 'STL', 'BLK'].map((key) => (
              <div className={`stat-pill ${statColor(key, player[key])}`} key={key}>
                <span className="stat-label">{key}</span>
                <span className="stat-value">{player[key]}</span>
              </div>
            ))}
            <div className={`stat-pill ${statColor('PLUS_MINUS', player.PLUS_MINUS)}`}>
              <span className="stat-label">+/-</span>
              <span className="stat-value">{player.PLUS_MINUS > 0 ? '+' : ''}{player.PLUS_MINUS}</span>
            </div>
          </div>

          <button
            className="toggle-stats-btn"
            onClick={(e) => { e.stopPropagation(); onToggleStats && onToggleStats(); }}
          >
            {showFullStats ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            <span>{showFullStats ? 'Hide Stats' : 'Full Stats'}</span>
          </button>

          {showFullStats && (
            <motion.div
              className="full-stats"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="full-stats-grid">
                <div className="fs-item"><span className="fs-label">FG%</span><span className="fs-val">{player.FG_PCT}%</span></div>
                <div className="fs-item"><span className="fs-label">3P%</span><span className="fs-val">{player.TP_PCT}%</span></div>
                <div className="fs-item"><span className="fs-label">FT%</span><span className="fs-val">{player.FT_PCT}%</span></div>
                <div className="fs-item"><span className="fs-label">MIN</span><span className="fs-val">{player.MIN}</span></div>
                <div className="fs-item"><span className="fs-label">TOV</span><span className="fs-val">{player.TOV}</span></div>
              </div>
            </motion.div>
          )}

          {!isWinner && !isLoser && (
            <div className="card-button">
              <div className="btn-text">Select Player</div>
              <div className="btn-icon">
                <FaBasketballBall />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="error-card">
            <h2>Something went wrong</h2>
            <p>The app encountered an error. Please try refreshing.</p>
            <button className="reset-btn" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Restore saved state (module-level, runs once) ---
const _saved = loadFromStorage();
const _hasSaved = !!((_saved) && _saved.leftPlayer && _saved.rightPlayer);

// --- Main App ---
function App() {
  const [allPlayers, setAllPlayers] = useState(() => _hasSaved ? (_saved.allPlayers || []) : []);
  const [deck, setDeck] = useState(() => _hasSaved ? (_saved.deck || []) : []);
  const [leftPlayer, setLeftPlayer] = useState(() => _hasSaved ? _saved.leftPlayer : null);
  const [rightPlayer, setRightPlayer] = useState(() => _hasSaved ? _saved.rightPlayer : null);
  const [loading, setLoading] = useState(() => !_hasSaved);
  const [error, setError] = useState(null);
  const [winner, setWinner] = useState(() => _hasSaved ? (_saved.winner || null) : null);
  const [matchLog, setMatchLog] = useState(() => _hasSaved ? (_saved.matchLog || []) : []);
  const [expandedLeft, setExpandedLeft] = useState(false);
  const [expandedRight, setExpandedRight] = useState(false);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [availableTeams, setAvailableTeams] = useState(() => _hasSaved ? deriveTeams(_saved.allPlayers || []) : []);
  const [selectedDate, setSelectedDate] = useState('');

  const winnerCardRef = useRef(null);

  function applyFetchedData(data) {
    const players = parsePlayers(data);
    if (players.length < 2) {
      setAllPlayers([]);
      setDeck([]);
      setLeftPlayer(null);
      setRightPlayer(null);
      setLoading(false);
      return;
    }
    setAllPlayers(players);
    setAvailableTeams(deriveTeams(players));
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    setLeftPlayer(shuffled[0]);
    setRightPlayer(shuffled[1]);
    setDeck(shuffled.slice(2));
    setWinner(null);
    setMatchLog([]);
    clearStorage();
    setLoading(false);
  }

  function fetchDeck(dateParam) {
    setLoading(true);
    setError(null);
    const url = dateParam
      ? `${API_BASE}/api/daily-deck?date=${dateParam}`
      : `${API_BASE}/api/daily-deck`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(applyFetchedData)
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }

  // Initial fetch via subscription-style effect (state set in async callback, not synchronously)
  useEffect(() => {
    if (_hasSaved) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/daily-deck`)
      .then(res => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) applyFetchedData(data);
      })
      .catch(err => {
        if (!cancelled) {
          console.error(err);
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Persist state to localStorage (syncing to external system)
  useEffect(() => {
    if (!loading && leftPlayer) {
      saveToStorage({ allPlayers, deck, leftPlayer, rightPlayer, winner, matchLog });
    }
  });

  function applyTeamFilter(team) {
    setTeamFilter(team);
    if (!allPlayers.length) return;

    const filtered = team === 'ALL'
      ? [...allPlayers]
      : allPlayers.filter(p => p.TEAM_ABBREVIATION === team);

    if (filtered.length < 2) return;

    const shuffled = filtered.sort(() => 0.5 - Math.random());
    setLeftPlayer(shuffled[0]);
    setRightPlayer(shuffled[1]);
    setDeck(shuffled.slice(2));
    setWinner(null);
    setMatchLog([]);
    setExpandedLeft(false);
    setExpandedRight(false);
  }

  function handleDateChange(e) {
    const val = e.target.value;
    setSelectedDate(val);
    clearStorage();
    setTeamFilter('ALL');
    fetchDeck(val || null);
  }

  function handlePick(side) {
    if (winner) return;

    const selected = side === 'left' ? leftPlayer : rightPlayer;
    const eliminated = side === 'left' ? rightPlayer : leftPlayer;

    const newLog = [...matchLog, {
      winner: selected.PLAYER_NAME,
      winnerId: selected.PLAYER_ID,
      winnerTeam: selected.TEAM_ABBREVIATION,
      winnerScore: computeGameScore(selected),
      loser: eliminated.PLAYER_NAME,
      loserId: eliminated.PLAYER_ID,
      loserTeam: eliminated.TEAM_ABBREVIATION,
      loserScore: computeGameScore(eliminated),
    }];
    setMatchLog(newLog);

    if (deck.length < 1) {
      setWinner(selected);
      return;
    }

    const updatedDeck = [...deck, selected];
    const shuffledDeck = updatedDeck.sort(() => 0.5 - Math.random());

    setLeftPlayer(shuffledDeck[0]);
    setRightPlayer(shuffledDeck[1]);
    setDeck(shuffledDeck.slice(2));
    setExpandedLeft(false);
    setExpandedRight(false);
  }

  function resetGame() {
    clearStorage();
    setWinner(null);
    setMatchLog([]);
    setTeamFilter('ALL');
    setExpandedLeft(false);
    setExpandedRight(false);
    fetchDeck(selectedDate || null);
  }

  async function handleShare() {
    if (!winner) return;
    const gs = computeGameScore(winner);
    const text = `🏀 My NBA Showdown Player of the Day: ${winner.PLAYER_NAME} (${winner.TEAM_ABBREVIATION}) with a Game Score of ${gs}! #NBAShowdown`;

    if (navigator.share) {
      try { await navigator.share({ title: 'NBA Daily Showdown', text }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(text); alert('Copied to clipboard!'); } catch { /* ignore */ }
    }
  }

  async function handleCopyLink() {
    if (!winner) return;
    const gs = computeGameScore(winner);
    const dateStr = selectedDate || new Date().toISOString().split('T')[0];
    const link = `${window.location.origin}/result?player=${encodeURIComponent(winner.PLAYER_NAME)}&score=${gs}&date=${dateStr}`;
    try { await navigator.clipboard.writeText(link); alert('Link copied!'); } catch { /* ignore */ }
  }

  const deckAvgScore = allPlayers.length > 0
    ? +(allPlayers.reduce((sum, p) => sum + computeGameScore(p), 0) / allPlayers.length).toFixed(1)
    : 0;

  // --- Render ---

  if (loading) return (
    <div className="container">
      <header className="header">
        <div className="logo-text">DAILY SHOWDOWN</div>
        <div className="subtitle">Loading today&apos;s matchups...</div>
      </header>
      <div className="arena">
        <div className="skeleton-card"><div className="skeleton-shine"></div></div>
        <div className="vs-badge">VS</div>
        <div className="skeleton-card"><div className="skeleton-shine"></div></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="container">
      <div className="error-card">
        <h2>Failed to load games</h2>
        <p>{error}</p>
        <button className="reset-btn" onClick={() => fetchDeck(selectedDate || null)}>Retry</button>
      </div>
    </div>
  );

  if (!leftPlayer || !rightPlayer) return (
    <div className="container">
      <header className="header">
        <div className="logo-text">DAILY SHOWDOWN</div>
        <div className="subtitle">No games found for this date</div>
      </header>
      <div className="controls-bar">
        <div className="date-picker-wrap">
          <FaCalendarAlt size={14} />
          <input type="date" value={selectedDate} onChange={handleDateChange} className="date-input" />
        </div>
      </div>
    </div>
  );

  if (winner) {
    const winnerScore = computeGameScore(winner);
    const winnerMatchups = matchLog.filter(m => m.winnerId === winner.PLAYER_ID);

    return (
      <div className="container">
        <header className="header">
          <div className="logo-text">
            <FaTrophy style={{ marginRight: '0.5rem', color: '#fbbf24' }} />
            PLAYER OF THE DAY
          </div>
          <div className="subtitle">Your top pick</div>
        </header>

        <div className="winner-stats-bar">
          <div className="ws-item">
            <span className="ws-label">Game Score</span>
            <span className="ws-value accent">{winnerScore}</span>
          </div>
          <div className="ws-item">
            <span className="ws-label">Deck Avg</span>
            <span className="ws-value">{deckAvgScore}</span>
          </div>
          <div className="ws-item">
            <span className="ws-label">vs Avg</span>
            <span className={`ws-value ${winnerScore > deckAvgScore ? 'stat-green' : 'stat-red'}`}>
              {winnerScore > deckAvgScore ? '+' : ''}{(winnerScore - deckAvgScore).toFixed(1)}
            </span>
          </div>
        </div>

        <div className="arena" ref={winnerCardRef}>
          <PlayerCard
            player={winner}
            isWinner={true}
            showFullStats={expandedLeft}
            onToggleStats={() => setExpandedLeft(p => !p)}
          />
        </div>

        {winnerMatchups.length > 0 && (
          <motion.div
            className="match-log"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="log-title"><FaHistory size={14} /> Path to Victory</h3>
            <div className="log-chain">
              {winnerMatchups.map((m, i) => (
                <div key={i} className="log-entry">
                  <span className="log-winner">{m.winner}</span>
                  <span className="log-score">{m.winnerScore}</span>
                  <span className="log-vs">beat</span>
                  <span className="log-loser">{m.loser}</span>
                  <span className="log-score dim">{m.loserScore}</span>
                  {i < winnerMatchups.length - 1 && <span className="log-arrow">→</span>}
                </div>
              ))}
              <div className="log-entry log-crown">
                <span>👑 WINNER</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="share-bar">
          <motion.button className="share-btn" onClick={handleShare}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <FaShareAlt /> Share
          </motion.button>
          <motion.button className="share-btn" onClick={handleCopyLink}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
            <FaLink /> Copy Link
          </motion.button>
        </div>

        <motion.button
          className="reset-btn"
          onClick={resetGame}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Play Again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="logo-text">DAILY SHOWDOWN</div>
        <div className="subtitle">Pick your favorite performance</div>
      </header>

      <div className="controls-bar">
        <div className="date-picker-wrap">
          <FaCalendarAlt size={14} />
          <input type="date" value={selectedDate} onChange={handleDateChange} className="date-input" />
        </div>
        {availableTeams.length > 0 && (
          <div className="team-filter-wrap">
            <FaFilter size={12} />
            <select
              value={teamFilter}
              onChange={(e) => applyTeamFilter(e.target.value)}
              className="team-select"
            >
              <option value="ALL">All Teams</option>
              {availableTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <motion.div
        className="scoreboard"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="score-item">
          <div className="score-label">Remaining</div>
          <div className="score-value">{deck.length}</div>
        </div>
        <div className="score-item">
          <div className="score-label">Matchups</div>
          <div className="score-value">{matchLog.length}</div>
        </div>
      </motion.div>

      <div className="arena">
        <AnimatePresence mode='popLayout'>
          <PlayerCard
            key={`left-${leftPlayer.PLAYER_ID}`}
            player={leftPlayer}
            onClick={() => handlePick('left')}
            showFullStats={expandedLeft}
            onToggleStats={() => setExpandedLeft(p => !p)}
          />
        </AnimatePresence>

        <div className="vs-badge">VS</div>

        <AnimatePresence mode='popLayout'>
          <PlayerCard
            key={`right-${rightPlayer.PLAYER_ID}`}
            player={rightPlayer}
            onClick={() => handlePick('right')}
            showFullStats={expandedRight}
            onToggleStats={() => setExpandedRight(p => !p)}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
