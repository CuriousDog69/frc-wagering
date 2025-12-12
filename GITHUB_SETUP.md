# GitHub Setup Guide

Follow these steps to connect your project to GitHub and enable automatic deployments.

## Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name**: `frc-wagering` (or any name you like)
   - **Description**: "FRC Match Wagering System"
   - **Visibility**: Choose Public or Private
   - **DO NOT** check "Initialize with README" (we already have files)
4. Click **"Create repository"**

## Step 2: Connect Your Local Repository

After creating the repo, GitHub will show you commands. Use these:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/frc-wagering.git

# Push your code
git branch -M main
git push -u origin main
```

## Step 3: Connect Railway to GitHub (Auto-Deploy)

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Settings** tab
4. Under **"Source"**, click **"Connect GitHub"**
5. Authorize Railway to access your GitHub
6. Select your repository: `YOUR_USERNAME/frc-wagering`
7. Railway will automatically deploy from your GitHub repo!

## Step 4: Future Updates (Workflow)

Now whenever you make changes:

```bash
# 1. Make your changes to files
# 2. Stage changes
git add .

# 3. Commit changes
git commit -m "Description of what you changed"

# 4. Push to GitHub
git push

# Railway will automatically detect the push and redeploy!
```

That's it! No more manual file copying. Just push to GitHub and Railway handles the rest.

## Troubleshooting

### If you get authentication errors:
- Use GitHub Personal Access Token instead of password
- Or use GitHub Desktop app for easier Git operations

### If Railway doesn't auto-deploy:
- Check Railway project settings → make sure GitHub is connected
- Check Railway logs for any errors
- Try manually redeploying once to see if it works

