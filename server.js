const express = require('express');
const path = require('path');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

// TBA API Configuration
const TBA_API_BASE = 'https://www.thebluealliance.com/api/v3';
let TBA_API_KEY = process.env.TBA_API_KEY || 'SdMHbJ9qgT5GUlkOJthWcuf6ddR9yAyMWawjNIKw0dP65UZHjYHkXlteqQcziHjC'; // Can be set via environment variable or admin endpoint
let TBA_EVENT_KEY = process.env.TBA_EVENT_KEY || ''; // Can be set via environment variable or admin endpoint
// Scouting reward and rate limit configuration (can be overridden via env or admin endpoint)
let SCOUTING_REWARD = process.env.SCOUTING_REWARD ? parseInt(process.env.SCOUTING_REWARD, 10) : 25;
let RATE_LIMIT_PER_SECOND = process.env.RATE_LIMIT_PER_SECOND ? parseFloat(process.env.RATE_LIMIT_PER_SECOND) : 5;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter (token-bucket per identifier)
const rateBuckets = {}; // { key: { tokens, last } }

function getRateKey(req) {
  // Prefer session tokens (admin/user) so limits apply per user/admin; otherwise fall back to IP
  if (req.headers['x-admin-session']) return `admin:${req.headers['x-admin-session']}`;
  if (req.headers['x-user-session']) return `user:${req.headers['x-user-session']}`;
  return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
}

function rateLimiter(req, res, next) {
  const key = getRateKey(req);
  const now = Date.now() / 1000; // seconds
  const limit = RATE_LIMIT_PER_SECOND;

  let bucket = rateBuckets[key];
  if (!bucket) {
    bucket = { tokens: limit, last: now };
  }

  const elapsed = Math.max(0, now - (bucket.last || now));
  // Refill tokens
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * limit);
  bucket.last = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    rateBuckets[key] = bucket;
    next();
  } else {
    const retryAfter = Math.ceil((1 - bucket.tokens) / Math.max(0.0001, limit));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many requests', retryAfter });
  }
}

// Apply rate limiter to all API routes
app.use('/api', rateLimiter);

// Serve index.html for root route and other routes (SPA fallback)
/*app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other HTML pages
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/leaderboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});*/

// In-memory data storage (in production, use a database)
let users = {}; // { username: { password: string, points: number, wagers: [] } }
let matches = []; // Start with no matches - admin must schedule them
let wagers = []; // { id, userId, matchId, team, points, status: 'pending'|'won'|'lost' }

let nextMatchId = 1;
let nextWagerId = 1;

// Admin authentication (simple session-based)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Can be set via environment variable
let adminSessions = new Set(); // Store session tokens

// User authentication (simple session-based)
let userSessions = {}; // { sessionToken: username }

// Helper function to get or create user
function getUser(username) {
  if (!users[username]) {
    users[username] = { password: '', name: username, points: 100, wagers: [] }; // Start with 100 points
  }
  return users[username];
}

// Helper to find a user by display name (case-insensitive)
function findUserByName(fullName) {
  const normalized = String(fullName || '').trim().toLowerCase();
  if (!normalized) return null;

  for (const [username, user] of Object.entries(users)) {
    const storedName = String(user.name || username).trim().toLowerCase();
    if (storedName === normalized) {
      return { username, user };
    }
  }

  return null;
}

// Helper function to make TBA API requests
function tbaRequest(endpoint) {
  return new Promise((resolve, reject) => {
    if (!TBA_API_KEY) {
      reject(new Error('TBA API key not configured'));
      return;
    }

    const url = `${TBA_API_BASE}${endpoint}`;
    const options = {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to convert TBA team key to team number (e.g., 'frc254' -> 'Team 254')
function formatTeamKey(teamKey) {
  if (!teamKey) return '';
  const match = teamKey.match(/frc(\d+)/);
  return match ? `Team ${match[1]}` : teamKey;
}

// API Routes

// Get active match (only one active match at a time)
app.get('/api/matches/active', (req, res) => {
  const activeMatch = matches.find(m => m.status === 'upcoming');
  res.json(activeMatch || null);
});

// Get match statistics (points wagered, multipliers)
app.get('/api/matches/:id/stats', (req, res) => {
  const match = matches.find(m => m.id === parseInt(req.params.id));
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const matchWagers = wagers.filter(w => w.matchId === match.id && w.status === 'pending');
  const team1Wagers = matchWagers.filter(w => w.team === match.team1);
  const team2Wagers = matchWagers.filter(w => w.team === match.team2);

  const team1Points = team1Wagers.reduce((sum, w) => sum + w.points, 0);
  const team2Points = team2Wagers.reduce((sum, w) => sum + w.points, 0);
  const totalPot = team1Points + team2Points;

  // Calculate multipliers: if a team wins, they get (total pot / their points wagered)
  // This means each winner gets their stake * multiplier
  // If no wagers on a team yet, show 1.00 (will update when first wager is placed)
  const team1Multiplier = team1Points > 0 ? (totalPot / team1Points).toFixed(2) : (totalPot > 0 ? '999.99' : '1.00');
  const team2Multiplier = team2Points > 0 ? (totalPot / team2Points).toFixed(2) : (totalPot > 0 ? '999.99' : '1.00');

  res.json({
    matchId: match.id,
    team1: match.team1,
    team2: match.team2,
    team1Points,
    team2Points,
    totalPot,
    team1Multiplier: parseFloat(team1Multiplier),
    team2Multiplier: parseFloat(team2Multiplier),
    team1WagerCount: team1Wagers.length,
    team2WagerCount: team2Wagers.length
  });
});

// Get all matches (for admin/history)
app.get('/api/matches', (req, res) => {
  res.json(matches);
});

// Get a specific match
app.get('/api/matches/:id', (req, res) => {
  const match = matches.find(m => m.id === parseInt(req.params.id));
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  res.json(match);
});

// User authentication middleware
function requireUser(req, res, next) {
  const sessionToken = req.headers['x-user-session'];
  if (!sessionToken || !userSessions[sessionToken]) {
    return res.status(401).json({ error: 'User authentication required' });
  }
  req.username = userSessions[sessionToken];
  next();
}

// User: Register/Login
app.post('/api/user/login', (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = getUser(username);

  // If user doesn't exist or password is being set for the first time
  if (!user.password) {
    // First time login - set password and optional display name
    user.password = password;
    if (name) user.name = name;
    const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    userSessions[sessionToken] = username;
    res.json({ success: true, sessionToken, username, name: user.name, isNewUser: true });
  } else if (user.password === password) {
    // Existing user - verify password
    // Update name if provided
    if (name) user.name = name;
    const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    userSessions[sessionToken] = username;
    res.json({ success: true, sessionToken, username, name: user.name, isNewUser: false });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// User: Logout
app.post('/api/user/logout', requireUser, (req, res) => {
  const sessionToken = req.headers['x-user-session'];
  delete userSessions[sessionToken];
  res.json({ success: true });
});

// Get user info
app.get('/api/user/me', requireUser, (req, res) => {
  const user = getUser(req.username);
  res.json({
    username: req.username,
    name: user.name || req.username,
    points: user.points,
    wagers: user.wagers.map(wagerId => wagers.find(w => w.id === wagerId))
  });
});

// User: Award fixed tokens for completing a scouting session via base64 full name
app.post('/api/user/scout-complete', (req, res) => {
  const encodedName = req.body && req.body.fullNameBase64 ? String(req.body.fullNameBase64) : '';
  if (!encodedName) {
    return res.status(400).json({ error: 'fullNameBase64 is required' });
  }

  let decodedName = '';
  try {
    decodedName = Buffer.from(encodedName, 'base64').toString('utf8').trim();
  } catch (err) {
    return res.status(400).json({ error: 'Invalid base64 full name' });
  }

  if (!decodedName) {
    return res.status(400).json({ error: 'Full name cannot be empty' });
  }

  const match = findUserByName(decodedName);
  if (!match) {
    return res.status(404).json({ error: 'User with provided full name not found' });
  }

  const { username: targetUsername, user } = match;

  user.points = (user.points || 0) + SCOUTING_REWARD;

  res.json({
    success: true,
    awarded: SCOUTING_REWARD,
    username: targetUsername,
    name: user.name,
    points: user.points,
    message: `Awarded ${SCOUTING_REWARD} points for completing scouting session to ${decodedName}`
  });
});

// Place a wager
app.post('/api/wager', requireUser, (req, res) => {
  const { matchId, team, points } = req.body;
  const username = req.username;

  // Validation
  if (!matchId || !team || !points) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (points <= 0) {
    return res.status(400).json({ error: 'Points must be greater than 0' });
  }

  const match = matches.find(m => m.id === parseInt(matchId));
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  if (match.status !== 'upcoming') {
    return res.status(400).json({ error: 'Cannot wager on completed matches' });
  }

  // Ensure only one active match at a time
  const activeMatch = matches.find(m => m.status === 'upcoming');
  if (activeMatch && activeMatch.id !== parseInt(matchId)) {
    return res.status(400).json({ error: 'Another match is already active. Please wait for it to complete.' });
  }

  if (team !== match.team1 && team !== match.team2) {
    return res.status(400).json({ error: 'Invalid team selection' });
  }

  const user = getUser(username);
  if (user.points < points) {
    return res.status(400).json({ error: 'Insufficient points' });
  }

  // Create wager
  const wager = {
    id: nextWagerId++,
    userId: username,
    matchId: parseInt(matchId),
    team,
    points: parseInt(points),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  wagers.push(wager);
  user.wagers.push(wager.id);
  user.points -= points;

  res.json({ success: true, wager, remainingPoints: user.points });
});

// Get all wagers for a match
app.get('/api/matches/:id/wagers', (req, res) => {
  const matchWagers = wagers.filter(w => w.matchId === parseInt(req.params.id));
  res.json(matchWagers);
});

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const sessionToken = req.headers['x-admin-session'];
  if (!sessionToken || !adminSessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}

// Admin: Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    adminSessions.add(sessionToken);
    res.json({ success: true, sessionToken });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Admin: Logout
app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const sessionToken = req.headers['x-admin-session'];
  adminSessions.delete(sessionToken);
  res.json({ success: true });
});

// Admin: Schedule a new match
app.post('/api/admin/matches', requireAdmin, (req, res) => {
  const { team1, team2 } = req.body;

  if (!team1 || !team2) {
    return res.status(400).json({ error: 'Both teams are required' });
  }

  // Check if there's already an active match
  const activeMatch = matches.find(m => m.status === 'upcoming');
  if (activeMatch) {
    return res.status(400).json({ error: 'There is already an active match. Please resolve it before scheduling a new one.' });
  }

  const match = {
    id: nextMatchId++,
    team1,
    team2,
    status: 'upcoming',
    result: null,
    createdAt: new Date().toISOString()
  };

  matches.push(match);
  res.json({ success: true, match });
});

// Admin: Resolve match (set result)
app.post('/api/matches/:id/resolve', requireAdmin, (req, res) => {
  const { winner } = req.body;
  const match = matches.find(m => m.id === parseInt(req.params.id));

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  if (match.status !== 'upcoming') {
    return res.status(400).json({ error: 'Match already resolved' });
  }

  if (winner !== match.team1 && winner !== match.team2) {
    return res.status(400).json({ error: 'Invalid winner' });
  }

  // Update match
  match.status = 'completed';
  match.result = winner;
  match.completedAt = new Date().toISOString();

  // Resolve all wagers for this match using pot-based system
  const matchWagers = wagers.filter(w => w.matchId === match.id && w.status === 'pending');
  
  // Calculate total pot and points on winning team
  const totalPot = matchWagers.reduce((sum, w) => sum + w.points, 0);
  const winningTeamWagers = matchWagers.filter(w => w.team === winner);
  const winningTeamPoints = winningTeamWagers.reduce((sum, w) => sum + w.points, 0);
  
  // Calculate multiplier: total pot divided by points on winning team
  // Each winner gets their stake * multiplier
  const multiplier = winningTeamPoints > 0 ? totalPot / winningTeamPoints : 0;

  matchWagers.forEach(wager => {
    const user = getUser(wager.userId);
    if (user) {
      if (wager.team === winner) {
        // Winner gets their stake * multiplier
        wager.status = 'won';
        const winnings = Math.floor(wager.points * multiplier);
        user.points += winnings;
        wager.winnings = winnings;
        wager.multiplier = multiplier;
      } else {
        wager.status = 'lost';
      }
    }
  });

  res.json({ success: true, match });
});

// Admin: Get all matches with stats
app.get('/api/admin/matches', requireAdmin, (req, res) => {
  const matchesWithStats = matches.map(match => {
    const matchWagers = wagers.filter(w => w.matchId === match.id);
    return {
      ...match,
      totalWagers: matchWagers.length,
      totalPointsWagered: matchWagers.reduce((sum, w) => sum + w.points, 0)
    };
  });
  res.json(matchesWithStats);
});

// Get leaderboard - top points
app.get('/api/leaderboard/points', (req, res) => {
  const leaderboard = Object.keys(users)
    .map(username => {
      const user = users[username];
      return {
        username,
        points: user.points
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 50); // Top 50
  
  res.json(leaderboard);
});

// Get leaderboard - most correct predictions
app.get('/api/leaderboard/predictions', (req, res) => {
  const leaderboard = Object.keys(users)
    .map(username => {
      const user = users[username];
      const userWagers = user.wagers
        .map(wagerId => wagers.find(w => w.id === wagerId))
        .filter(w => w && w.status === 'won');
      
      return {
        username,
        correctPredictions: userWagers.length,
        totalWagers: user.wagers.length,
        winRate: user.wagers.length > 0 
          ? ((userWagers.length / user.wagers.length) * 100).toFixed(1)
          : '0.0'
      };
    })
    .filter(user => user.totalWagers > 0) // Only users who have made wagers
    .sort((a, b) => {
      // Sort by correct predictions first, then by win rate
      if (b.correctPredictions !== a.correctPredictions) {
        return b.correctPredictions - a.correctPredictions;
      }
      return parseFloat(b.winRate) - parseFloat(a.winRate);
    })
    .slice(0, 50); // Top 50
  
  res.json(leaderboard);
});

// Admin: Reset all user points to 100
app.post('/api/admin/reset-points', requireAdmin, (req, res) => {
  let resetCount = 0;
  Object.keys(users).forEach(username => {
    users[username].points = 100;
    resetCount++;
  });
  
  res.json({ 
    success: true, 
    message: `Reset ${resetCount} user(s) to 100 points`,
    resetCount 
  });
});

// Admin: Configure TBA API
app.post('/api/admin/tba/config', requireAdmin, (req, res) => {
  const { apiKey, eventKey } = req.body;
  
  if (apiKey) {
    TBA_API_KEY = apiKey;
  }
  if (eventKey) {
    TBA_EVENT_KEY = eventKey;
  }
  
  res.json({ 
    success: true, 
    message: 'TBA configuration updated',
    hasApiKey: !!TBA_API_KEY,
    eventKey: TBA_EVENT_KEY || 'Not set'
  });
});

// Admin: Get TBA configuration
app.get('/api/admin/tba/config', requireAdmin, (req, res) => {
  res.json({
    hasApiKey: !!TBA_API_KEY,
    eventKey: TBA_EVENT_KEY || '',
    apiKeySet: !!TBA_API_KEY
  });
});

// Admin: Get/Set application config (scouting reward, rate limit)
app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json({
    scoutingReward: SCOUTING_REWARD,
    rateLimitPerSecond: RATE_LIMIT_PER_SECOND
  });
});

app.post('/api/admin/config', requireAdmin, (req, res) => {
  const { scoutingReward, rateLimitPerSecond } = req.body || {};
  if (typeof scoutingReward !== 'undefined') {
    const val = parseInt(scoutingReward, 10);
    if (!isNaN(val) && val >= 0) SCOUTING_REWARD = val;
  }
  if (typeof rateLimitPerSecond !== 'undefined') {
    const rl = parseFloat(rateLimitPerSecond);
    if (!isNaN(rl) && rl > 0) RATE_LIMIT_PER_SECOND = rl;
  }

  res.json({ success: true, scoutingReward: SCOUTING_REWARD, rateLimitPerSecond: RATE_LIMIT_PER_SECOND });
});

// Admin: Fetch matches from TBA
app.post('/api/admin/tba/sync', requireAdmin, async (req, res) => {
  if (!TBA_API_KEY || !TBA_EVENT_KEY) {
    return res.status(400).json({ error: 'TBA API key and event key must be configured first' });
  }

  try {
    // Fetch matches from TBA
    const tbaMatches = await tbaRequest(`/event/${TBA_EVENT_KEY}/matches`);
    
    // Filter for qualification matches that haven't been played yet
    const upcomingMatches = tbaMatches
      .filter(m => m.comp_level === 'qm' && m.actual_time === null)
      .sort((a, b) => a.match_number - b.match_number);

    if (upcomingMatches.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No upcoming matches found in TBA',
        matchesFound: 0
      });
    }

    // Check if there's already an active match
    const activeMatch = matches.find(m => m.status === 'upcoming');
    if (activeMatch) {
      return res.status(400).json({ 
        error: 'There is already an active match. Please resolve it before syncing from TBA.',
        activeMatchId: activeMatch.id
      });
    }

    // Get the next match to schedule
    const nextMatch = upcomingMatches[0];
    const redAlliance = nextMatch.alliances.red.team_keys;
    const blueAlliance = nextMatch.alliances.blue.team_keys;

    // Format team names (use first team from each alliance for simplicity)
    const team1 = formatTeamKey(redAlliance[0]);
    const team2 = formatTeamKey(blueAlliance[0]);

    // Create match
    const match = {
      id: nextMatchId++,
      team1,
      team2,
      status: 'upcoming',
      result: null,
      createdAt: new Date().toISOString(),
      tbaMatchKey: nextMatch.key,
      tbaMatchNumber: nextMatch.match_number,
      source: 'tba'
    };

    matches.push(match);

    res.json({ 
      success: true, 
      message: `Scheduled match from TBA: ${team1} vs ${team2}`,
      match,
      upcomingMatchesRemaining: upcomingMatches.length - 1
    });
  } catch (error) {
    console.error('TBA sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync with TBA',
      details: error.message 
    });
  }
});

// Admin: Auto-resolve matches from TBA
app.post('/api/admin/tba/auto-resolve', requireAdmin, async (req, res) => {
  if (!TBA_API_KEY || !TBA_EVENT_KEY) {
    return res.status(400).json({ error: 'TBA API key and event key must be configured first' });
  }

  try {
    // Get active match
    const activeMatch = matches.find(m => m.status === 'upcoming');
    if (!activeMatch) {
      return res.json({ 
        success: true, 
        message: 'No active match to resolve',
        resolved: false
      });
    }

    // If match doesn't have TBA key, can't auto-resolve
    if (!activeMatch.tbaMatchKey) {
      return res.status(400).json({ 
        error: 'Active match was not created from TBA. Please resolve manually.',
        matchId: activeMatch.id
      });
    }

    // Fetch match result from TBA
    const tbaMatch = await tbaRequest(`/match/${activeMatch.tbaMatchKey}`);
    
    // Check if match has been played
    if (!tbaMatch.actual_time) {
      return res.json({ 
        success: true, 
        message: 'Match has not been played yet according to TBA',
        resolved: false,
        matchStatus: 'not_played'
      });
    }

    // Determine winner
    let winner = null;
    if (tbaMatch.winning_alliance === 'red') {
      winner = activeMatch.team1;
    } else if (tbaMatch.winning_alliance === 'blue') {
      winner = activeMatch.team2;
    } else {
      return res.status(400).json({ 
        error: 'Match result is not available or match was tied',
        tbaResult: tbaMatch.winning_alliance
      });
    }

    // Resolve the match (reuse existing resolve logic)
    activeMatch.status = 'completed';
    activeMatch.result = winner;
    activeMatch.completedAt = new Date().toISOString();

    // Resolve all wagers for this match using pot-based system
    const matchWagers = wagers.filter(w => w.matchId === activeMatch.id && w.status === 'pending');
    
    const totalPot = matchWagers.reduce((sum, w) => sum + w.points, 0);
    const winningTeamWagers = matchWagers.filter(w => w.team === winner);
    const winningTeamPoints = winningTeamWagers.reduce((sum, w) => sum + w.points, 0);
    const multiplier = winningTeamPoints > 0 ? totalPot / winningTeamPoints : 0;

    matchWagers.forEach(wager => {
      const user = getUser(wager.userId);
      if (user) {
        if (wager.team === winner) {
          wager.status = 'won';
          const winnings = Math.floor(wager.points * multiplier);
          user.points += winnings;
          wager.winnings = winnings;
          wager.multiplier = multiplier;
        } else {
          wager.status = 'lost';
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Match resolved from TBA: ${winner} won`,
      match: activeMatch,
      wagersResolved: matchWagers.length
    });
  } catch (error) {
    console.error('TBA auto-resolve error:', error);
    res.status(500).json({ 
      error: 'Failed to auto-resolve from TBA',
      details: error.message 
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

