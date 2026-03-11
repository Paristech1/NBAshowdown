import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { FaBasketballBall, FaChevronDown, FaChevronUp, FaHistory, FaTwitter, FaFacebookF, FaInstagram, FaFire } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import React from 'react';
import { parsePlayers, computeGameScore } from './lib/deckUtils';
import { fetchDailyDeck } from './lib/fetchDeck';
import './App.css';

const DAILY_DECK_URL = import.meta.env.PROD
  ? '/.netlify/functions/daily-deck'
  : '/api/daily-deck';
const STORAGE_KEY = 'nba_showdown_state';

const LEAGUE_AVG = {
  PTS: 15, REB: 5, AST: 5, STL: 1, BLK: 0.5, PLUS_MINUS: 0,
};

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

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1040 760' fill='%23333'%3E%3Crect width='1040' height='760' fill='%23222'/%3E%3Ccircle cx='520' cy='280' r='140' fill='%23444'/%3E%3Cellipse cx='520' cy='600' rx='220' ry='180' fill='%23444'/%3E%3C/svg%3E";

function buildShareText(winner, gs) {
  return `🏀 My NBA Showdown Player of the Game: ${winner.PLAYER_NAME} (${winner.TEAM_ABBREVIATION}) with a Game Score of ${gs}! #NBAShowdown`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

async function generateShareCard(winner, gs, deckAvg) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, W, H);

  const radialGrad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.8);
  radialGrad.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
  radialGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radialGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, W, H);

  let img = null;
  try {
    img = await loadImage(`https://cdn.nba.com/headshots/nba/latest/1040x760/${winner.PLAYER_ID}.png`);
  } catch {
    img = null;
  }

  const grd = ctx.createLinearGradient(0, H * 0.5, 0, H);
  grd.addColorStop(0, 'rgba(251, 191, 36, 0.0)');
  grd.addColorStop(1, 'rgba(251, 191, 36, 0.12)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.5, 400, 0, Math.PI * 2);
  ctx.fill();

  const grad1 = ctx.createLinearGradient(0, 0, 0, 100);
  grad1.addColorStop(0, '#fff');
  grad1.addColorStop(1, '#888');
  ctx.fillStyle = grad1;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NBA SHOWDOWN', W / 2, 120);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('BALLER OF THE NIGHT!', W / 2, 180);

  const goldGrad = ctx.createLinearGradient(0, 0, W, 0);
  goldGrad.addColorStop(0, '#fbbf24');
  goldGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = goldGrad;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('YOU WIN!', W / 2, 260);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '24px sans-serif';
  ctx.fillText('BALLER OF THE NIGHT', W / 2, 320);

  const cardX = 90;
  const cardY = 380;
  const cardW = W - 180;
  const cardH = 900;
  const radius = 40;

  function drawRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  drawRoundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (img) {
    ctx.save();
    drawRoundRect(cardX + 20, cardY + 80, cardW - 40, 420, 20);
    ctx.clip();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(img, cardX + 20, cardY + 80, cardW - 40, 420);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const badgeY = cardY + 52;
  const badgeFont = 'bold 20px sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cardX + 45, badgeY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = badgeFont;
  ctx.textAlign = 'left';
  ctx.fillText('WINNER', cardX + 58, badgeY + 7);

  ctx.fillStyle = '#fbbf24';
  ctx.font = badgeFont;
  ctx.textAlign = 'right';
  ctx.fillText(`G. SCORE: ${gs}`, cardX + cardW - 25, badgeY + 7);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(winner.PLAYER_NAME, W / 2, cardY + 560);

  const stats = `${winner.PTS} PTS • ${winner.REB} REB • ${winner.AST} AST • ${winner.STL} STL`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '26px sans-serif';
  ctx.fillText(stats, W / 2, cardY + 620);

  const diff = (gs - deckAvg).toFixed(1);
  const diffStr = gs > deckAvg ? `+${diff}` : diff;
  const deckBefore = `Deck Avg: ${deckAvg} | `;
  const deckAfter = ` vs Avg: ${deckAvg}`;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  const deckFullWidth = ctx.measureText(deckBefore + diffStr + deckAfter).width;
  let deckX = (W - deckFullWidth) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(deckBefore, deckX, cardY + 680);
  deckX += ctx.measureText(deckBefore).width;
  ctx.fillStyle = gs > deckAvg ? '#22c55e' : 'rgba(255,255,255,0.5)';
  ctx.fillText(diffStr, deckX, cardY + 680);
  deckX += ctx.measureText(diffStr).width;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(deckAfter, deckX, cardY + 680);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '18px sans-serif';
  ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), W / 2, H - 80);
  ctx.fillText('nbashowdown.app', W / 2, H - 40);

  return canvas;
}

// --- VictoryWinnerCard ---
const VictoryWinnerCard = ({ player, gameScore, deckAvg }) => {
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PLAYER_ID}.png`;
  const diff = (gameScore - deckAvg).toFixed(1);
  const diffStr = gameScore > deckAvg ? `+${diff}` : diff;
  const stats = `${player.PTS} PTS • ${player.REB} REB • ${player.AST} AST • ${player.STL} STL`;

  return (
    <motion.div
      className="victory-winner-card"
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <img
        src={imgUrl}
        alt={player.PLAYER_NAME}
        className="victory-card-bg"
        onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
      />
      <div className="victory-card-filter" />
      <div className="victory-card-glow" />

      <div className="victory-badge-winner">
        <div className="victory-badge-winner-dot" />
        <span className="victory-badge-winner-text">WINNER</span>
      </div>
      <div className="victory-badge-gscore">
        <span className="victory-badge-gscore-text">G. SCORE: {gameScore}</span>
      </div>

      <div className="victory-card-body">
        <div className="victory-player-img-wrap">
          <img
            src={imgUrl}
            alt={player.PLAYER_NAME}
            className="victory-player-img"
            onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
          />
        </div>
        <div className="victory-player-name">{player.PLAYER_NAME}</div>
        <div className="victory-stat-pill">{stats}</div>
        <div className="victory-deck-comparison">
          Deck Avg: {deckAvg} | <span className={gameScore > deckAvg ? 'vs-diff' : ''}>{diffStr}</span> vs Avg: {deckAvg}
        </div>
      </div>
    </motion.div>
  );
};


const LeadersPreviewCard = ({ player }) => {
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PLAYER_ID}.png`;

  return (
    <div className="leaders-card">
      <img
        src={imgUrl}
        alt={player.PLAYER_NAME}
        className="leaders-card-bg"
        onError={(e) => { e.currentTarget.src = PLACEHOLDER_SVG; }}
      />
      <div className="leaders-card-overlay" />
      <div className="leaders-card-content">
        <div className="leaders-player-name">{player.PLAYER_NAME}</div>
        <div className="leaders-player-team">{player.TEAM_ABBREVIATION}</div>
        <div className="leaders-player-score">{player.PTS} PTS • {player.AST} AST • {player.REB} REB</div>
      </div>
    </div>
  );
};

// --- PlayerCard ---
const PlayerCard = ({ player, onClick, isWinner, isLoser, showFullStats, onToggleStats }) => {
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PLAYER_ID}.png`;
  const gameScore = computeGameScore(player);

  return (
    <motion.div
      className={`card-wrap pointer ${isWinner ? 'winner-card' : ''} ${isLoser ? 'loser-card' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -40, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.28,
        ease: [0.25, 0.1, 0.25, 1],
      }}
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

const _saved = loadFromStorage();
const _hasSaved = !!((_saved) && _saved.leftPlayer && _saved.rightPlayer);

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
  const [matchLogExpanded, setMatchLogExpanded] = useState(false);
  const [shareImageLoading, setShareImageLoading] = useState(false);
  const [screen, setScreen] = useState('home');

  const winnerCardRef = useRef(null);

  const PARTICLE_POSITIONS = [
    { left: '10%', top: '20%', delay: 0 },
    { left: '85%', top: '15%', delay: 0.5 },
    { left: '50%', top: '30%', delay: 1 },
    { left: '25%', top: '60%', delay: 1.5 },
    { left: '70%', top: '55%', delay: 2 },
    { left: '15%', top: '80%', delay: 0.8 },
    { left: '90%', top: '75%', delay: 1.2 },
    { left: '45%', top: '85%', delay: 2.5 },
  ];

  function applyFetchedData(data) {
    const players = parsePlayers(data);
    if (players.length < 2 || !players[0] || !players[1]) {
      setAllPlayers([]);
      setDeck([]);
      setLeftPlayer(null);
      setRightPlayer(null);
      setWinner(null);
      setMatchLog([]);
      setLoading(false);
      clearStorage();
      return;
    }
    setAllPlayers(players);
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    setLeftPlayer(shuffled[0]);
    setRightPlayer(shuffled[1]);
    setDeck(shuffled.slice(2));
    setWinner(null);
    setMatchLog([]);
    clearStorage();
    setLoading(false);
  }

  function fetchDeck() {
    setLoading(true);
    setError(null);
    fetchDailyDeck(DAILY_DECK_URL)
      .then(applyFetchedData)
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    if (_hasSaved) return;
    let cancelled = false;
    fetchDailyDeck(DAILY_DECK_URL)
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

  useEffect(() => {
    if (!loading && leftPlayer) {
      saveToStorage({ allPlayers, deck, leftPlayer, rightPlayer, winner, matchLog });
    }
  });

  function handlePick(side) {
    if (winner) return;
    const selected = side === 'left' ? leftPlayer : rightPlayer;
    const eliminated = side === 'left' ? rightPlayer : leftPlayer;
    if (!selected || !eliminated) return;

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
    setAllPlayers([]);
    setDeck([]);
    setLeftPlayer(null);
    setRightPlayer(null);
    setWinner(null);
    setMatchLog([]);
    setMatchLogExpanded(false);
    setExpandedLeft(false);
    setExpandedRight(false);
    setShareImageLoading(false);
    setError(null);
    setLoading(true);
    setScreen('game');
    fetchDeck();
  }

  // --- Social sharing ---
  function shareToTwitter() {
    if (!winner) return;
    const text = buildShareText(winner, computeGameScore(winner));
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
  }

  function shareToFacebook() {
    if (!winner) return;
    const text = buildShareText(winner, computeGameScore(winner));
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
  }

  async function downloadForInstagram() {
    if (!winner || shareImageLoading) return;
    setShareImageLoading(true);
    try {
      const gs = computeGameScore(winner);
      const canvas = await generateShareCard(winner, gs, deckAvgScore);
      const link = document.createElement('a');
      link.download = `nba_showdown_${winner.PLAYER_NAME.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Share card generation failed:', err);
    } finally {
      setShareImageLoading(false);
    }
  }

  const deckAvgScore = allPlayers.length > 0
    ? +(allPlayers.reduce((sum, p) => sum + computeGameScore(p), 0) / allPlayers.length).toFixed(1)
    : 0;

  const topPerformers = useMemo(() => ([...allPlayers]
    .sort((a, b) => (b.PTS - a.PTS) || (b.AST - a.AST) || (b.REB - a.REB) || a.PLAYER_NAME.localeCompare(b.PLAYER_NAME))
    .slice(0, 5)), [allPlayers]);

  // --- Render ---

  if (loading) return (
    <div className="container">
      <header className="header">
        <button type="button" className="logo-text logo-home-trigger" onClick={() => setScreen('home')}>NBA SHOWDOWN</button>
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
        <button className="reset-btn" onClick={fetchDeck}>Retry</button>
      </div>
    </div>
  );

  if (!leftPlayer || !rightPlayer) return (
    <div className="container">
      <header className="header">
        <button type="button" className="logo-text logo-home-trigger" onClick={() => setScreen('home')}>NBA SHOWDOWN</button>
        <div className="subtitle">No games found today</div>
      </header>
      <button className="reset-btn" onClick={fetchDeck}>Try Again</button>
    </div>
  );

  if (winner) {
    const winnerScore = computeGameScore(winner);
    const winnerMatchups = matchLog.filter(m => m.winnerId === winner.PLAYER_ID);

    return (
      <div className="victory-screen">
        <div className="victory-particles">
          {PARTICLE_POSITIONS.map((p, i) => (
            <div
              key={i}
              className="victory-particle"
              style={{
                left: p.left,
                top: p.top,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="victory-content container">
          <motion.header
            className="header"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="victory-title">Baller of the Night</div>
            <div className="victory-subheader">One star rose above the rest tonight.</div>
          </motion.header>

          <div className="arena" ref={winnerCardRef}>
            <VictoryWinnerCard
              player={winner}
              gameScore={winnerScore}
              deckAvg={deckAvgScore}
            />
          </div>

          {winnerMatchups.length > 0 && (
            <div className="match-log-wrapper">
              <button
                type="button"
                className="match-log-toggle"
                onClick={() => setMatchLogExpanded(prev => !prev)}
                aria-expanded={matchLogExpanded}
              >
                <FaHistory size={14} />
                {matchLogExpanded ? 'Hide Path to Victory' : 'Show Path to Victory'}
              </button>
              <div
                className={`match-log-collapsible ${matchLogExpanded ? 'expanded' : ''}`}
                aria-hidden={!matchLogExpanded}
              >
                <div className="match-log">
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
                </div>
              </div>
            </div>
          )}

          <motion.div
            className="share-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="share-label">Share your pick</div>
            <div className="share-bar">
              <button className="share-btn twitter" onClick={shareToTwitter} title="Share on X / Twitter">
                <FaTwitter size={18} />
                <span>Twitter</span>
              </button>
              <button className="share-btn facebook" onClick={shareToFacebook} title="Share on Facebook">
                <FaFacebookF size={18} />
                <span>Facebook</span>
              </button>
              <button
                className="share-btn instagram"
                onClick={downloadForInstagram}
                disabled={shareImageLoading}
                title="Download image for Instagram"
              >
                <FaInstagram size={18} />
                <span>{shareImageLoading ? 'Generating...' : 'Instagram'}</span>
              </button>
            </div>
            <div className="share-hint">Instagram: downloads a share card you can post to your story or feed</div>
          </motion.div>

          <motion.button
            type="button"
            className="victory-btn-primary victory-cta-single"
            onClick={resetGame}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            PLAY AGAIN
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <AnimatePresence mode="wait">
        {screen === 'home' && (
          <motion.section
            key="home"
            className="home-hub"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.35 }}
          >
            <header className="header">
              <button type="button" className="logo-text logo-home-trigger" onClick={() => setScreen('home')}>NBA SHOWDOWN</button>
              <div className="subtitle">Your game, your vibe</div>
            </header>
            <p className="home-hub-copy">Jump into a fresh bracket or preview tonight's hottest stat leaders.</p>
            <div className="home-hub-actions">
              <button className="hub-btn hub-btn-primary" onClick={() => setScreen('game')}>
                Fresh Game
              </button>
              <button className="hub-btn hub-btn-secondary" onClick={() => setScreen('leaders')}>
                <FaFire size={14} />
                Stat Leaders
              </button>
            </div>
          </motion.section>
        )}

        {screen === 'game' && (
          <motion.section
            key="game"
            className="screen-panel"
            initial={{ opacity: 0, y: 70 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -70 }}
            transition={{ duration: 0.35 }}
          >
            <header className="header">
              <button type="button" className="logo-text logo-home-trigger" onClick={() => setScreen('home')}>NBA SHOWDOWN</button>
              <div className="subtitle">Pick your favorite performance</div>
            </header>
            <motion.div
              className="scoreboard"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
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
              <div className="arena-slot">
                <AnimatePresence mode="wait">
                  <PlayerCard
                    key={`left-${leftPlayer.PLAYER_ID}`}
                    player={leftPlayer}
                    onClick={() => handlePick('left')}
                    showFullStats={expandedLeft}
                    onToggleStats={() => setExpandedLeft(p => !p)}
                  />
                </AnimatePresence>
              </div>

              <div className="vs-badge">VS</div>

              <div className="arena-slot">
                <AnimatePresence mode="wait">
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

            <button className="restart-btn" onClick={resetGame}>
              Restart
            </button>
          </motion.section>
        )}

        {screen === 'leaders' && (
          <motion.section
            key="leaders"
            className="screen-panel"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ duration: 0.35 }}
          >
            <header className="header">
              <button type="button" className="logo-text logo-home-trigger" onClick={() => setScreen('home')}>NBA SHOWDOWN</button>
              <div className="subtitle">Tonight's top stat leaders</div>
            </header>
            <div className="leaders-flow">
              {topPerformers.slice(0, 5).map((player, idx) => (
                <div key={`${player.PLAYER_ID}-${idx}`} className="leaders-flow-item">
                  <LeadersPreviewCard player={player} />
                </div>
              ))}
            </div>

            <div className="screen-panel-actions">
              <button className="hub-btn hub-btn-primary" onClick={() => setScreen('game')}>Fresh Game</button>
              <button className="restart-btn" onClick={() => setScreen('home')}>Back</button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
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
