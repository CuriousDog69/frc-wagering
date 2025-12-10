# Deployment Guide

This guide covers easy ways to deploy your FRC Wagering application so others can access it.

## Quick Deploy Options (Recommended)

### Option 1: Railway (Easiest - Recommended)

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub
2. **Create new project**: Click "New Project"
3. **Deploy from GitHub**:
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect Node.js and deploy
4. **Set environment variables** (optional):
   - Go to your project → Variables
   - Add `ADMIN_PASSWORD` with a secure password (recommended!)
   - Add `TBA_API_KEY` if you want it persistent
   - Add `TBA_EVENT_KEY` for your event
   - Note: `PORT` is set automatically by Railway
5. **Get your URL**: Railway provides a URL like `your-app.railway.app`

**Pros**: Very easy, free tier available, auto-deploys on git push
**Cons**: Free tier has usage limits

---

### Option 2: Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up
2. **Create new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
3. **Configure**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. **Set environment variables** (optional):
   - Add `PORT` (Render sets this automatically)
   - Add `TBA_API_KEY` if needed
5. **Deploy**: Click "Create Web Service"

**Pros**: Free tier, easy setup, auto-deploys
**Cons**: Free tier spins down after inactivity

---

### Option 3: Fly.io

1. **Install Fly CLI**: 
   ```bash
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```
2. **Sign up**: Run `fly auth signup`
3. **Deploy**:
   ```bash
   fly launch
   ```
   - Follow prompts (use defaults)
   - Fly.io will create a `fly.toml` file
4. **Deploy**: `fly deploy`

**Pros**: Good free tier, global edge network
**Cons**: Requires CLI setup

---

## Important Notes Before Deploying

### 1. Security Considerations

⚠️ **IMPORTANT**: Before deploying, change these in `server.js`:

- **Admin Password**: Change `ADMIN_PASSWORD` from `'admin123'` to something secure
- **TBA API Key**: Consider using environment variables instead of hardcoding

### 2. Data Persistence

⚠️ **Current Limitation**: The app uses in-memory storage. All data (users, matches, wagers) will be lost when the server restarts.

**Solutions**:
- For production, consider adding a database (MongoDB, PostgreSQL, etc.)
- For now, users will need to re-register after restarts

### 3. Environment Variables

You can make the app more secure by using environment variables:

```javascript
// In server.js, replace:
const ADMIN_PASSWORD = 'admin123';
// With:
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
```

Then set `ADMIN_PASSWORD` in your deployment platform's environment variables.

---

## Step-by-Step: Railway Deployment (Recommended)

1. **Prepare your code**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   
   Note: The `.env.example` file shows what environment variables you can set. You don't need to create a `.env` file for Railway - set variables in the Railway dashboard instead.

2. **Push to GitHub**:
   - Create a new repository on GitHub
   - Push your code:
   ```bash
   git remote add origin https://github.com/yourusername/yourrepo.git
   git push -u origin main
   ```

3. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will automatically:
     - Detect it's a Node.js app
     - Install dependencies
     - Start the server
   - Wait for deployment (usually 1-2 minutes)

4. **Get your URL**:
   - Railway provides a URL like `your-app.up.railway.app`
   - Share this URL with others!

5. **Custom Domain (Optional)**:
   - In Railway project settings, you can add a custom domain

---

## Testing Your Deployment

1. Visit your deployment URL
2. Try creating a user account
3. Test admin login (use your admin password)
4. Schedule a match
5. Place a wager
6. Resolve the match

---

## Troubleshooting

### Server won't start
- Check that `PORT` environment variable is set (platforms usually set this automatically)
- Check logs in your deployment platform's dashboard

### Can't access the site
- Make sure the server is listening on `0.0.0.0` (already configured)
- Check firewall/security settings in your deployment platform

### Data keeps disappearing
- This is expected with in-memory storage
- Consider adding a database for production use

---

## Next Steps (Optional Improvements)

1. **Add a database** (MongoDB, PostgreSQL) for data persistence
2. **Add HTTPS** (most platforms provide this automatically)
3. **Set up monitoring** (platforms usually have built-in monitoring)
4. **Add error tracking** (Sentry, etc.)
5. **Implement rate limiting** to prevent abuse

---

## Quick Comparison

| Platform | Ease | Free Tier | Auto-Deploy | Best For |
|----------|------|-----------|-------------|----------|
| Railway | ⭐⭐⭐⭐⭐ | Yes | Yes | Quickest setup |
| Render | ⭐⭐⭐⭐ | Yes | Yes | Simple deployments |
| Fly.io | ⭐⭐⭐ | Yes | Yes | Global edge network |
| Heroku | ⭐⭐⭐ | Limited | Yes | Established platform |

**Recommendation**: Start with **Railway** for the easiest experience!

