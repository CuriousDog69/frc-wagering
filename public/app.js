let userSessionToken = null;
let currentUsername = null;
let currentMatch = null;
let currentMatchId = null;

// Initialize - check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('userSessionToken');
    const savedUsername = localStorage.getItem('username');
    
    if (savedToken && savedUsername) {
        userSessionToken = savedToken;
        currentUsername = savedUsername;
        checkAuth();
    } else {
        showLogin();
    }
});

// Check authentication
async function checkAuth() {
    if (!userSessionToken) {
        showLogin();
        return;
    }

    try {
        const response = await fetch('/api/user/me', {
            headers: {
                'x-user-session': userSessionToken
            }
        });

        if (response.ok) {
            showApp();
            loadUserInfo();
            loadMatches();
        } else {
            // Session invalid
            userSessionToken = null;
            currentUsername = null;
            localStorage.removeItem('userSessionToken');
            localStorage.removeItem('username');
            showLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showLogin();
    }
}

// User login
async function userLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorEl = document.getElementById('loginError');

    if (!username || !password) {
        errorEl.textContent = 'Please enter both name and password';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/user/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (response.ok) {
            userSessionToken = result.sessionToken;
            currentUsername = result.username;
            localStorage.setItem('userSessionToken', userSessionToken);
            localStorage.setItem('username', currentUsername);
            
            if (result.isNewUser) {
                alert(`Welcome, ${username}! Your account has been created with 1000 starting points.`);
            }
            
            showApp();
            loadUserInfo();
            loadMatches();
        } else {
            errorEl.textContent = result.error || 'Login failed';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Failed to login. Please try again.';
        errorEl.style.display = 'block';
    }
}

// User logout
async function userLogout() {
    if (userSessionToken) {
        try {
            await fetch('/api/user/logout', {
                method: 'POST',
                headers: {
                    'x-user-session': userSessionToken
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    userSessionToken = null;
    currentUsername = null;
    localStorage.removeItem('userSessionToken');
    localStorage.removeItem('username');
    showLogin();
    document.getElementById('loginForm').reset();
}

// Show login screen
function showLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// Show main app
function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('usernameDisplay').textContent = currentUsername;
}

// Load active match (only one at a time)
async function loadMatches() {
    try {
        const response = await fetch('/api/matches/active');
        const match = await response.json();
        
        // Only re-render if match changed
        if (!match || match.id !== currentMatchId) {
            displayActiveMatch(match);
        } else {
            // Just update stats if match is the same
            updateMatchStats(match.id);
        }
    } catch (error) {
        console.error('Error loading match:', error);
    }
}

// Update match statistics without re-rendering (prevents glitching)
async function updateMatchStats(matchId) {
    if (!matchId) {
        document.getElementById('statsBar').style.display = 'none';
        return;
    }

    try {
        const statsResponse = await fetch(`/api/matches/${matchId}/stats`);
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            updateStatsBar(stats);
        }
    } catch (error) {
        console.error('Error updating match stats:', error);
    }
}

// Update the stats bar at the top (optimized to prevent glitching)
function updateStatsBar(stats) {
    const statsBar = document.getElementById('statsBar');
    if (!stats || stats.totalPot === 0) {
        if (statsBar.style.display !== 'none') {
            statsBar.style.display = 'none';
            document.body.classList.remove('stats-bar-visible');
        }
        return;
    }

    // Only update display if it was hidden
    if (statsBar.style.display === 'none') {
        statsBar.style.display = 'block';
        document.body.classList.add('stats-bar-visible');
    }

    const team1Percent = stats.totalPot > 0 ? (stats.team1Points / stats.totalPot * 100) : 50;
    const team2Percent = stats.totalPot > 0 ? (stats.team2Points / stats.totalPot * 100) : 50;

    // Update labels and values (only if changed to prevent unnecessary DOM updates)
    const label1 = document.getElementById('statsBarLabel1');
    const value1 = document.getElementById('statsBarValue1');
    const label2 = document.getElementById('statsBarLabel2');
    const value2 = document.getElementById('statsBarValue2');
    
    if (label1.textContent !== stats.team1) label1.textContent = stats.team1;
    const newValue1 = `${stats.team1Points} pts`;
    if (value1.textContent !== newValue1) value1.textContent = newValue1;
    
    if (label2.textContent !== stats.team2) label2.textContent = stats.team2;
    const newValue2 = `${stats.team2Points} pts`;
    if (value2.textContent !== newValue2) value2.textContent = newValue2;

    // Update the fill bars with smooth transitions
    const team1Fill = document.getElementById('statsBarTeam1Fill');
    const team2Fill = document.getElementById('statsBarTeam2Fill');
    
    // Only update if changed (prevent unnecessary style updates)
    const newWidth1 = `${team1Percent}%`;
    const newWidth2 = `${team2Percent}%`;
    
    if (team1Fill.style.width !== newWidth1) {
        team1Fill.style.width = newWidth1;
    }
    if (team2Fill.style.width !== newWidth2) {
        team2Fill.style.width = newWidth2;
    }
    
    // Show percentage in the bar if there's enough space
    const percent1Text = team1Percent > 10 ? `${team1Percent.toFixed(0)}%` : '';
    const percent2Text = team2Percent > 10 ? `${team2Percent.toFixed(0)}%` : '';
    
    if (team1Fill.textContent !== percent1Text) {
        team1Fill.textContent = percent1Text;
    }
    if (team2Fill.textContent !== percent2Text) {
        team2Fill.textContent = percent2Text;
    }
}

// Display active match (only renders once, stats updated separately)
async function displayActiveMatch(match) {
    const matchesList = document.getElementById('matchesList');
    
    if (!match) {
        currentMatchId = null;
        matchesList.innerHTML = `
            <div class="no-match">
                <p style="text-align: center; color: #999; font-size: 1.2em; padding: 40px;">
                    No active match at the moment.<br>
                    Please wait for an admin to schedule a match.
                </p>
            </div>
        `;
        document.getElementById('statsBar').style.display = 'none';
        return;
    }

    // Only re-render if match ID changed
    if (match.id === currentMatchId && matchesList.children.length > 0) {
        // Match already displayed, just update stats
        updateMatchStats(match.id);
        return;
    }

    currentMatchId = match.id;
    matchesList.innerHTML = '';

    const matchCard = document.createElement('div');
    matchCard.className = 'match-card';

    matchCard.innerHTML = `
        <div class="match-teams">
            <span>${match.team1}</span>
            <span class="match-vs">VS</span>
            <span>${match.team2}</span>
        </div>
        <div class="match-status">
            <span class="status-badge status-${match.status}">${match.status.toUpperCase()}</span>
            <button class="wager-btn" onclick="openWagerModal(${match.id})">
                Place Wager
            </button>
        </div>
    `;

    matchesList.appendChild(matchCard);
    
    // Load and display stats in the bar
    updateMatchStats(match.id);
}

// Load user info
async function loadUserInfo() {
    if (!userSessionToken) return;
    
    try {
        const response = await fetch('/api/user/me', {
            headers: {
                'x-user-session': userSessionToken
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            document.getElementById('userPoints').textContent = `Points: ${user.points}`;
            displayWagers(user.wagers);
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Display user wagers
function displayWagers(wagers) {
    const wagersList = document.getElementById('wagersList');
    wagersList.innerHTML = '';

    if (!wagers || wagers.length === 0) {
        wagersList.innerHTML = '<p style="color: #999; text-align: center;">No wagers yet</p>';
        return;
    }

    wagers.forEach(wager => {
        if (!wager) return;
        
        const wagerItem = document.createElement('div');
        wagerItem.className = `wager-item ${wager.status}`;
        
        const statusText = {
            'pending': '⏳ Pending',
            'won': '✅ Won',
            'lost': '❌ Lost'
        };

        let winningsInfo = '';
        if (wager.status === 'won' && wager.winnings !== undefined) {
            winningsInfo = `<div style="color: #4caf50; font-size: 0.9em; font-weight: bold; margin-top: 5px;">
                Won: ${wager.winnings} points (${wager.multiplier ? wager.multiplier.toFixed(2) : 'N/A'}x)
            </div>`;
        }

        wagerItem.innerHTML = `
            <div class="wager-details">
                <span><strong>Match ${wager.matchId}</strong> - ${wager.team}</span>
                <span class="wager-status">${statusText[wager.status] || wager.status}</span>
            </div>
            <div style="color: #666; font-size: 0.9em;">
                Wagered: ${wager.points} points
            </div>
            ${winningsInfo}
        `;

        wagersList.appendChild(wagerItem);
    });
}

// Open wager modal
async function openWagerModal(matchId) {
    try {
        const [matchResponse, statsResponse] = await Promise.all([
            fetch(`/api/matches/${matchId}`),
            fetch(`/api/matches/${matchId}/stats`)
        ]);
        
        const match = await matchResponse.json();
        currentMatch = match;
        
        let stats = null;
        if (statsResponse.ok) {
            stats = await statsResponse.json();
        }
        
        let statsInfo = '';
        if (stats) {
            statsInfo = `
                <div style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 5px; font-size: 0.9em;">
                    <div><strong>${match.team1}:</strong> ${stats.team1Points} pts (${stats.team1Multiplier}x if wins)</div>
                    <div><strong>${match.team2}:</strong> ${stats.team2Points} pts (${stats.team2Multiplier}x if wins)</div>
                    <div style="margin-top: 5px;"><strong>Total Pot:</strong> ${stats.totalPot} points</div>
                </div>
            `;
        }
        
        document.getElementById('matchInfo').innerHTML = `
            <strong>Match ${match.id}</strong><br>
            ${match.team1} <strong>VS</strong> ${match.team2}
            ${statsInfo}
        `;
        
        const teamSelect = document.getElementById('teamSelect');
        teamSelect.innerHTML = `
            <option value="">Choose a team...</option>
            <option value="${match.team1}" data-multiplier="${stats ? stats.team1Multiplier : '1.00'}">${match.team1} ${stats ? `(${stats.team1Multiplier}x)` : ''}</option>
            <option value="${match.team2}" data-multiplier="${stats ? stats.team2Multiplier : '1.00'}">${match.team2} ${stats ? `(${stats.team2Multiplier}x)` : ''}</option>
        `;
        
        // Update potential winnings when team or points change
        teamSelect.addEventListener('change', updatePotentialWinnings);
        document.getElementById('pointsInput').addEventListener('input', updatePotentialWinnings);
        
        document.getElementById('pointsInput').value = '';
        document.getElementById('potentialWinnings').style.display = 'none';
        
        const modal = document.getElementById('wagerModal');
        modal.classList.add('show');
    } catch (error) {
        console.error('Error opening wager modal:', error);
        alert('Failed to load match details');
    }
}

// Update potential winnings display
function updatePotentialWinnings() {
    const teamSelect = document.getElementById('teamSelect');
    const pointsInput = document.getElementById('pointsInput');
    const potentialWinnings = document.getElementById('potentialWinnings');
    
    if (teamSelect.value && pointsInput.value && parseInt(pointsInput.value) > 0) {
        const multiplier = parseFloat(teamSelect.options[teamSelect.selectedIndex].dataset.multiplier || '1.00');
        const points = parseInt(pointsInput.value);
        const winnings = Math.floor(points * multiplier);
        
        potentialWinnings.innerHTML = `
            <div style="margin-top: 10px; padding: 10px; background: #e8f5e9; border-radius: 5px; color: #2e7d32;">
                <strong>If you win:</strong> ${winnings} points (${multiplier}x multiplier)
            </div>
        `;
        potentialWinnings.style.display = 'block';
    } else {
        potentialWinnings.style.display = 'none';
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('wagerModal');
    modal.classList.remove('show');
    currentMatch = null;
    
    // Clean up event listeners
    const teamSelect = document.getElementById('teamSelect');
    const pointsInput = document.getElementById('pointsInput');
    if (teamSelect) {
        teamSelect.removeEventListener('change', updatePotentialWinnings);
    }
    if (pointsInput) {
        pointsInput.removeEventListener('input', updatePotentialWinnings);
    }
    document.getElementById('potentialWinnings').style.display = 'none';
}

// Place wager
async function placeWager(event) {
    event.preventDefault();
    
    if (!userSessionToken) {
        alert('Please login first');
        return;
    }
    
    const team = document.getElementById('teamSelect').value;
    const points = parseInt(document.getElementById('pointsInput').value);
    
    if (!currentMatch) {
        alert('No match selected');
        return;
    }
    
    try {
        const response = await fetch('/api/wager', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-session': userSessionToken
            },
            body: JSON.stringify({
                matchId: currentMatch.id,
                team,
                points
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Wager placed successfully! Remaining points: ${result.remainingPoints}`);
            closeModal();
            loadUserInfo();
            loadMatches();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Error placing wager:', error);
        alert('Failed to place wager');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('wagerModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Auto-refresh stats every 5 seconds (less glitchy)
let refreshInterval = setInterval(() => {
    if (userSessionToken && document.getElementById('mainApp').style.display !== 'none') {
        if (currentMatchId) {
            updateMatchStats(currentMatchId);
        } else {
            loadMatches();
        }
        loadUserInfo();
    }
}, 5000);
