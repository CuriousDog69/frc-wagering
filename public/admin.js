let adminSessionToken = null;

// Custom Modal System
const CustomModal = {
    overlay: null,
    icon: null,
    title: null,
    message: null,
    buttons: null,

    init() {
        this.overlay = document.getElementById('customModalOverlay');
        this.icon = document.getElementById('customModalIcon');
        this.title = document.getElementById('customModalTitle');
        this.message = document.getElementById('customModalMessage');
        this.buttons = document.getElementById('customModalButtons');

        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
    },

    show(options) {
        const { type = 'info', title = '', message = '', buttons = [] } = options;

        const icons = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        this.icon.textContent = icons[type] || icons.info;
        this.icon.className = `custom-modal-icon ${type}`;

        this.title.textContent = title;
        this.message.textContent = message;

        this.buttons.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `custom-modal-btn ${btn.style || 'secondary'}`;
            button.textContent = btn.text;
            button.onclick = () => {
                if (btn.onClick) btn.onClick();
                this.close();
            };
            this.buttons.appendChild(button);
        });

        this.overlay.classList.add('show');
    },

    close() {
        this.overlay.classList.remove('show');
    },

    alert(message, title = 'Notice') {
        return new Promise(resolve => {
            this.show({
                type: 'info',
                title,
                message,
                buttons: [
                    { text: 'OK', style: 'primary', onClick: resolve }
                ]
            });
        });
    },

    success(message, title = 'Success') {
        return new Promise(resolve => {
            this.show({
                type: 'success',
                title,
                message,
                buttons: [
                    { text: 'OK', style: 'primary', onClick: resolve }
                ]
            });
        });
    },

    error(message, title = 'Error') {
        return new Promise(resolve => {
            this.show({
                type: 'error',
                title,
                message,
                buttons: [
                    { text: 'OK', style: 'primary', onClick: resolve }
                ]
            });
        });
    },

    confirm(message, title = 'Confirm') {
        return new Promise(resolve => {
            this.show({
                type: 'warning',
                title,
                message,
                buttons: [
                    { text: 'Cancel', style: 'secondary', onClick: () => resolve(false) },
                    { text: 'Confirm', style: 'danger', onClick: () => resolve(true) }
                ]
            });
        });
    }
};

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('adminSessionToken');
    if (savedToken) {
        adminSessionToken = savedToken;
        checkAdminAuth();
    }
});

// Admin login
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (response.ok) {
            adminSessionToken = result.sessionToken;
            localStorage.setItem('adminSessionToken', adminSessionToken);
            showDashboard();
            loadDashboardData();
        } else {
            errorEl.textContent = result.error || 'Invalid password';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Failed to login';
        errorEl.style.display = 'block';
    }
}

// Admin logout
async function adminLogout() {
    if (adminSessionToken) {
        try {
            await fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'x-admin-session': adminSessionToken
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    adminSessionToken = null;
    localStorage.removeItem('adminSessionToken');
    showLogin();
}

// Check admin authentication
async function checkAdminAuth() {
    if (!adminSessionToken) {
        showLogin();
        return;
    }

    try {
        const response = await fetch('/api/admin/matches', {
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        if (response.ok) {
            showDashboard();
            loadDashboardData();
        } else {
            adminSessionToken = null;
            localStorage.removeItem('adminSessionToken');
            showLogin();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showLogin();
    }
}

// Show login screen
function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}

// Schedule a new match
async function scheduleMatch(event) {
    event.preventDefault();

    const team1 = document.getElementById('team1Input').value.trim();
    const team2 = document.getElementById('team2Input').value.trim();

    if (!team1 || !team2) {
        alert('Please enter both teams');
        return;
    }

    try {
        const response = await fetch('/api/admin/matches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-session': adminSessionToken
            },
            body: JSON.stringify({ team1, team2 })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Match scheduled successfully!');
            document.getElementById('scheduleForm').reset();
            loadDashboardData();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Schedule error:', error);
        alert('Failed to schedule match');
    }
}

// Load dashboard data
async function loadDashboardData() {
    await Promise.all([
        loadActiveMatch(),
        loadMatchHistory(),
        loadTBAConfig()
    ]);
}

// Load active match
async function loadActiveMatch() {
    try {
        const response = await fetch('/api/matches/active');
        const match = await response.json();
        displayActiveMatch(match);
    } catch (error) {
        console.error('Error loading active match:', error);
    }
}

// Display active match
function displayActiveMatch(match) {
    const display = document.getElementById('activeMatchDisplay');

    if (!match) {
        display.innerHTML = '<p style="text-align: center; color: #999;">No active match</p>';
        return;
    }

    display.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin-bottom: 10px;">Match ${match.id}</h3>
            <div style="font-size: 1.2em; font-weight: bold;">
                ${match.team1} <span style="color: #999;">VS</span> ${match.team2}
            </div>
        </div>
        <div class="match-controls">
            <select id="winnerSelect">
                <option value="">Select winner...</option>
                <option value="${match.team1}">${match.team1}</option>
                <option value="${match.team2}">${match.team2}</option>
            </select>
            <button onclick="resolveMatch(${match.id})">Resolve Match</button>
        </div>
    `;
}

// Resolve match
async function resolveMatch(matchId) {
    const winner = document.getElementById('winnerSelect').value;

    if (!winner) {
        alert('Please select a winner');
        return;
    }

    if (!confirm(`Are you sure ${winner} won this match? This will resolve all wagers.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/matches/${matchId}/resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-session': adminSessionToken
            },
            body: JSON.stringify({ winner })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Match resolved successfully! Wagers have been processed.');
            loadDashboardData();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Resolve error:', error);
        alert('Failed to resolve match');
    }
}

// Load match history
async function loadMatchHistory() {
    try {
        const response = await fetch('/api/admin/matches', {
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        const matches = await response.json();
        displayMatchHistory(matches);
    } catch (error) {
        console.error('Error loading match history:', error);
    }
}

// Display match history
function displayMatchHistory(matches) {
    const history = document.getElementById('matchHistory');
    history.innerHTML = '';

    if (matches.length === 0) {
        history.innerHTML = '<p style="text-align: center; color: #999;">No matches yet</p>';
        return;
    }

    // Sort matches: upcoming first, then completed by date
    const sortedMatches = [...matches].sort((a, b) => {
        if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
        if (a.status !== 'upcoming' && b.status === 'upcoming') return 1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    sortedMatches.forEach(match => {
        const item = document.createElement('div');
        item.className = `history-item ${match.status === 'completed' ? 'completed' : ''}`;

        const resultText = match.status === 'completed' 
            ? `<strong>Winner: ${match.result}</strong>` 
            : '<span style="color: #ff9800;">⏳ Active</span>';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <strong>Match ${match.id}</strong>: ${match.team1} vs ${match.team2}
                </div>
                <div>${resultText}</div>
            </div>
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-value">${match.totalWagers || 0}</div>
                    <div class="stat-label">Total Wagers</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${match.totalPointsWagered || 0}</div>
                    <div class="stat-label">Points Wagered</div>
                </div>
            </div>
        `;

        history.appendChild(item);
    });
}

// Reset all user points to 100
async function resetAllPoints() {
    if (!confirm('Are you sure you want to reset ALL user points to 100? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/reset-points', {
            method: 'POST',
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        const result = await response.json();

        if (response.ok) {
            const messageEl = document.getElementById('resetMessage');
            messageEl.textContent = result.message;
            messageEl.style.display = 'block';
            messageEl.style.color = '#4caf50';
            
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        } else {
            const messageEl = document.getElementById('resetMessage');
            messageEl.textContent = `Error: ${result.error}`;
            messageEl.style.display = 'block';
            messageEl.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Reset points error:', error);
        const messageEl = document.getElementById('resetMessage');
        messageEl.textContent = 'Failed to reset points';
        messageEl.style.display = 'block';
        messageEl.style.color = '#f44336';
    }
}

// Load TBA configuration
async function loadTBAConfig() {
    try {
        const response = await fetch('/api/admin/tba/config', {
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        if (response.ok) {
            const config = await response.json();
            const statusEl = document.getElementById('tbaConfigStatus');
            if (config.hasApiKey) {
                statusEl.innerHTML = `✅ TBA configured | Event: ${config.eventKey || 'Not set'}`;
                statusEl.style.display = 'block';
                statusEl.style.background = '#e8f5e9';
                statusEl.style.color = '#2e7d32';
            } else {
                statusEl.innerHTML = '⚠️ TBA API key not configured';
                statusEl.style.display = 'block';
                statusEl.style.background = '#fff3e0';
                statusEl.style.color = '#e65100';
            }
        }
    } catch (error) {
        console.error('Error loading TBA config:', error);
    }
}

// Save TBA configuration
async function saveTBAConfig() {
    const apiKey = document.getElementById('tbaApiKey').value.trim();
    const eventKey = document.getElementById('tbaEventKey').value.trim();

    if (!apiKey) {
        alert('Please enter a TBA API key');
        return;
    }

    if (!eventKey) {
        alert('Please enter an event key');
        return;
    }

    try {
        const response = await fetch('/api/admin/tba/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-session': adminSessionToken
            },
            body: JSON.stringify({ apiKey, eventKey })
        });

        const result = await response.json();

        if (response.ok) {
            alert('TBA configuration saved successfully!');
            loadTBAConfig();
            document.getElementById('tbaApiKey').value = '';
            document.getElementById('tbaEventKey').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Error saving TBA config:', error);
        alert('Failed to save TBA configuration');
    }
}

// Sync next match from TBA
async function syncFromTBA() {
    if (!confirm('This will schedule the next upcoming match from TBA. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/tba/sync', {
            method: 'POST',
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        const result = await response.json();

        const messageEl = document.getElementById('tbaMessage');
        if (response.ok) {
            messageEl.textContent = result.message;
            messageEl.style.display = 'block';
            messageEl.style.color = '#4caf50';
            loadDashboardData();
            
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        } else {
            messageEl.textContent = `Error: ${result.error}`;
            messageEl.style.display = 'block';
            messageEl.style.color = '#f44336';
        }
    } catch (error) {
        console.error('TBA sync error:', error);
        const messageEl = document.getElementById('tbaMessage');
        messageEl.textContent = 'Failed to sync from TBA';
        messageEl.style.display = 'block';
        messageEl.style.color = '#f44336';
    }
}

// Auto-resolve match from TBA
async function autoResolveFromTBA() {
    if (!confirm('This will check TBA and resolve the active match if it has been played. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/tba/auto-resolve', {
            method: 'POST',
            headers: {
                'x-admin-session': adminSessionToken
            }
        });

        const result = await response.json();

        const messageEl = document.getElementById('tbaMessage');
        if (response.ok) {
            if (result.resolved) {
                messageEl.textContent = result.message;
                messageEl.style.display = 'block';
                messageEl.style.color = '#4caf50';
                loadDashboardData();
            } else {
                messageEl.textContent = result.message;
                messageEl.style.display = 'block';
                messageEl.style.color = '#ff9800';
            }
            
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        } else {
            messageEl.textContent = `Error: ${result.error}`;
            messageEl.style.display = 'block';
            messageEl.style.color = '#f44336';
        }
    } catch (error) {
        console.error('TBA auto-resolve error:', error);
        const messageEl = document.getElementById('tbaMessage');
        messageEl.textContent = 'Failed to auto-resolve from TBA';
        messageEl.style.display = 'block';
        messageEl.style.color = '#f44336';
    }
}

// Auto-refresh dashboard every 5 seconds
setInterval(() => {
    if (adminSessionToken && document.getElementById('dashboard').style.display !== 'none') {
        loadDashboardData();
    }
}, 5000);

