# FRC Match Wagering System

A simple web application for wagering points on FRC (First Robotics Competition) match outcomes.

## Features

- **Single Active Match**: Only one match is active at a time for focused wagering
- **Admin Dashboard**: Schedule matches and resolve outcomes through a web interface
- **User Wagering**: Place wagers on match outcomes
- **Points Tracking**: Track your wagers and points balance
- **Automatic Payouts**: Winners receive double their wagered points when matches are resolved
- **Clean, Modern UI**: Beautiful interface for both users and admins

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### For Users

1. **Enter a User ID**: Type your user ID in the input field (default: "user1")
2. **Load Profile**: Click "Load Profile" to see your points balance and wagers
3. **Place Wagers**: Click "Place Wager" on the active match
4. **Select Team**: Choose which team you think will win
5. **Enter Points**: Enter the amount of points you want to wager
6. **Submit**: Click "Place Wager" to confirm

### For Admins

1. **Access Admin Dashboard**: Click "Admin Dashboard" link in the header
2. **Login**: Enter the admin password (default: `admin123`)
3. **Schedule Matches**: Enter two team names and click "Schedule Match"
4. **Resolve Matches**: Select the winner from the dropdown and click "Resolve Match"
5. **View History**: See all matches and their statistics in the Match History section

**Note**: Only one match can be active at a time. You must resolve the current match before scheduling a new one.

## API Endpoints

### Public Endpoints
- `GET /api/matches/active` - Get the currently active match (only one at a time)
- `GET /api/matches` - Get all matches (for admin/history)
- `GET /api/matches/:id` - Get a specific match
- `GET /api/user/:userId` - Get user info and wagers
- `POST /api/wager` - Place a new wager

### Admin Endpoints (require authentication)
- `POST /api/admin/login` - Login as admin (returns session token)
- `POST /api/admin/logout` - Logout
- `POST /api/admin/matches` - Schedule a new match manually
- `GET /api/admin/matches` - Get all matches with statistics
- `POST /api/matches/:id/resolve` - Resolve a match manually
- `POST /api/admin/tba/config` - Configure TBA API key and event key
- `GET /api/admin/tba/config` - Get current TBA configuration
- `POST /api/admin/tba/sync` - Sync next match from TBA
- `POST /api/admin/tba/auto-resolve` - Auto-resolve active match from TBA

## Admin Authentication

The default admin password is `admin123`. You can change this in `server.js` by modifying the `ADMIN_PASSWORD` constant.

**Important**: Change the admin password before deploying to production!

## Match Resolution

When a match is resolved:
- All wagers go into a pot
- The pot is divided among winners based on their stake
- Winners receive: `Their Stake × (Total Pot / Points on Winning Team)`
- Losers forfeit their wagered points
- All wagers are marked as "won" or "lost"
- The match status changes to "completed"
- A new match can then be scheduled

## Starting Points

All users start with 100 points when they first use the system.

## The Blue Alliance (TBA) Integration

The system supports automatic match scheduling and resolution from The Blue Alliance API.

### Setting Up TBA Integration

1. **Get a TBA API Key:**
   - Create an account at [The Blue Alliance](https://www.thebluealliance.com/)
   - Go to your Account Dashboard
   - Generate a Read API Key

2. **Find Your Event Key:**
   - Event keys follow the format: `YYYY[event_code]`
   - Example: `2024mndu` for 2024 Minnesota Duluth
   - Find event keys on TBA event pages

3. **Configure in Admin Dashboard:**
   - Go to Admin Dashboard
   - Enter your TBA API key and event key
   - Click "Save TBA Configuration"

### Using TBA Integration

- **Sync Next Match**: Automatically schedules the next upcoming qualification match from TBA
- **Auto-Resolve**: Checks TBA and automatically resolves the active match if it has been played
- **Manual Override**: You can still schedule and resolve matches manually if TBA is not covering the event

### Notes

- TBA integration only works for qualification matches (qm)
- Manual scheduling/resolving still works for events not on TBA
- The system tracks which matches came from TBA vs manual entry

## Security Notes

- Admin sessions are stored in memory and will be lost when the server restarts
- For production use, consider implementing proper session management and password hashing
- The admin password is stored in plain text in the server code - change it before deploying
- TBA API keys are stored in memory - they will be lost on server restart

