import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBasketballBall } from 'react-icons/fa';
import { MdVerified } from 'react-icons/md';
import './App.css';

const PlayerCard = ({ player, onClick, isWinner }) => {
  // NBA CDN for headshots
  const imgUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.PLAYER_ID}.png`;

  return (
    <motion.div
      className={`card-wrap pointer ${isWinner ? 'winner-card' : ''}`}
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
        {/* Background Image (Headshot) */}
        <img src={imgUrl} alt={player.PLAYER_NAME} className="card-bg" />
        <div className="card-filter"></div>

        {/* Status Badge */}
        <div className="card-status">
          <div className="status-dot online"></div>
          <div className="status-text">ACTIVE</div>
        </div>

        {/* Content */}
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

          {/* Stats Grid */}
          <div className="card-stats">
            <div className="stat-pill">
              <span className="stat-label">PTS</span>
              <span className="stat-value">{player.PTS}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">REB</span>
              <span className="stat-value">{player.REB}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">AST</span>
              <span className="stat-value">{player.AST}</span>
            </div>
          </div>

          {/* Action Button */}
          {!isWinner && (
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

function App() {
  const [deck, setDeck] = useState([]);
  const [leftPlayer, setLeftPlayer] = useState(null);
  const [rightPlayer, setRightPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/daily-deck')
      .then(res => res.json())
      .then(data => {
        const allPlayers = [];
        if (Array.isArray(data)) {
          // Flatten the pairs into a single list of players
          data.forEach(pair => {
            allPlayers.push(pair.player_left);
            allPlayers.push(pair.player_right);
          });
        }

        // Shuffle the flat list for good measure, though backend shuffles too
        const shuffled = allPlayers.sort(() => 0.5 - Math.random());

        if (shuffled.length >= 2) {
          setLeftPlayer(shuffled[0]);
          setRightPlayer(shuffled[1]);
          setDeck(shuffled.slice(2));
        } else {
          // Handle edge case of not enough players
          setDeck([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handlePick = (side) => {
    if (winner) return;

    const selectedPlayer = side === 'left' ? leftPlayer : rightPlayer;

    // If deck has less than 2 players, we have a winner!
    if (deck.length < 2) {
      setWinner(selectedPlayer);
      return;
    }

    // Add the chosen player back to the deck
    const updatedDeck = [...deck, selectedPlayer];

    // Shuffle the deck to randomize when they reappear
    const shuffledDeck = updatedDeck.sort(() => 0.5 - Math.random());

    // Pull two new players for the next showdown
    setLeftPlayer(shuffledDeck[0]);
    setRightPlayer(shuffledDeck[1]);
    setDeck(shuffledDeck.slice(2));
  };

  const resetGame = () => {
    window.location.reload();
  };

  if (loading) return (
    <div className="container">
      <motion.h1
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="logo-text"
      >
        LOADING...
      </motion.h1>
    </div>
  );

  if (!leftPlayer || !rightPlayer) return <div className="container"><h1>No games found.</h1></div>;

  if (winner) {
    return (
      <div className="container">
        <header className="header">
          <div className="logo-text">PLAYER OF THE DAY</div>
          <div className="subtitle">Your top pick</div>
        </header>

        <div className="arena">
          <PlayerCard player={winner} isWinner={true} />
        </div>

        <motion.button
          className="reset-btn"
          onClick={resetGame}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Play Again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="logo-text">DAILY SHOWDOWN</div>
        <div className="subtitle">Pick your favorite performance</div>
      </header>

      {/* Progress */}
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
      </motion.div>

      {/* Arena */}
      <div className="arena">
        <AnimatePresence mode='popLayout'>
          <PlayerCard
            key={leftPlayer.PLAYER_ID}
            player={leftPlayer}
            onClick={() => handlePick('left')}
          />
        </AnimatePresence>

        <div className="vs-badge">VS</div>

        <AnimatePresence mode='popLayout'>
          <PlayerCard
            key={rightPlayer.PLAYER_ID}
            player={rightPlayer}
            onClick={() => handlePick('right')}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
