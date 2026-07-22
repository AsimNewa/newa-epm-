# GitHub Repository Setup Guide

## Prerequisites

Before proceeding, ensure you have:
- A GitHub account (https://github.com)
- Git installed and configured locally
- SSH keys configured (recommended) or GitHub token

## Steps to Push to GitHub

### Step 1: Create Repository on GitHub

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `newa-epm`
3. **D escription**: 
   ```
   NEWA Enterprise Performance Management - Cloud-native financial consolidation and reporting platform
   ```
4. **Visibility**: Choose **Public** (recommended for open source) or **Private** (for confidential)
5. **Initialize without README** (we already have one)
6. **Create repository**

### Step 2: Add Remote and Push

1. **Copy the repository URL**:
   - SSH (recommended): `git@github.com:your-username/newa-epm.git`
   - HTTPS: `https://github.com/your-username/newa-epm.git`

2. **Navigate to project**:
   ```bash
   cd d:\NewaDevEnv\NewaPlan\newa-epm
   ```

3. **Add remote**:
   ```bash
   git remote add origin git@github.com:your-username/newa-epm.git
   ```
   (Replace `your-username` with your GitHub username)

4. **Verify remote**:
   ```bash
   git remote -v
   ```

5. **Stage all files**:
   ```bash
   git add .
   ```

6. **Create initial commit**:
   ```bash
   git commit -m "chore: initial project setup from NEWA EPM specification v2"
   ```

7. **Push to GitHub**:
   ```bash
   git branch -M main
   git push -u origin main
   ```

### Step 3: Configure Repository Settings (Optional but Recommended)

On GitHub, go to your repository settings:

1. **Branch Protection** (Settings > Branches):
   - Protect main branch
   - Require PR reviews before merge
   - Require status checks to pass

2. **Code Security** (Settings > Security & analysis):
   - Enable Dependabot alerts
   - Enable code scanning

3. **Add Topics** (Settings > General):
   - Add: `newa`, `epm`, `financial`, `consolidation`, `nestjs`, `react`, `typescript`

### Step 4: Setup CI/CD (Already Configured)

The `.github/workflows/ci-cd.yml` file is already created.

CI/CD will automatically:
- Run linting on every push
- Run tests on every PR
- Build the project
- Generate coverage reports

## SSH Key Setup (Recommended)

If you haven't set up SSH keys yet:

### Windows PowerShell

```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# When prompted, press Enter to use default location
# Set a passphrase (optional but recommended)

# Copy the public key
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard
```

### Add Public Key to GitHub

1. Go to GitHub Settings: https://github.com/settings/keys
2. Click **New SSH key**
3. Paste the public key
4. Click **Add SSH key**

## Verify Setup

After pushing, verify everything is working:

```bash
# Verify remote
git remote -v

# Check logs
git log --oneline

# Check status
git status

# View on GitHub
# Navigate to https://github.com/your-username/newa-epm
```

## Next Steps

1. **Create Development Branch**:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

2. **Create Feature Branches**:
   ```bash
   git checkout -b feature/phase1-auth
   # Make changes
   git push -u origin feature/phase1-auth
   ```

3. **Set up Collaborators** (if team):
   - Go to Settings > Collaborators
   - Add team members

4. **Enable GitHub Discussions** (for community):
   - Settings > Features > Discussions

## Useful GitHub Features

### Actions
- View CI/CD runs: Actions tab
- Debug workflows if needed

### Projects
- Create project board for sprint tracking
- Organize issues and PRs by phase

### Wiki
- Add project documentation
- Architecture diagrams
- Setup guides

### Releases
- Create releases after each phase
- Auto-generate release notes

## Troubleshooting

### Authentication Failed
```bash
# If using HTTPS, generate token:
# https://github.com/settings/tokens
# Use token as password

# If using SSH, verify key:
ssh -T git@github.com
```

### Already Have a Repo
```bash
# Remove existing remote
git remote remove origin

# Add correct remote
git remote add origin <new-url>
```

### Want to Change Visibility (Public ↔ Private)
1. Go to Settings > General
2. Scroll to Danger Zone
3. Change repository visibility

---

## Example: Full Workflow

```bash
# 1. Create repo on GitHub (https://github.com/new)

# 2. Navigate to project
cd d:\NewaDevEnv\NewaPlan\newa-epm

# 3. Initialize git (already done)
git status

# 4. Add GitHub remote
git remote add origin git@github.com:your-username/newa-epm.git

# 5. Commit all files
git add .
git commit -m "chore: initial project setup"

# 6. Push to GitHub
git branch -M main
git push -u origin main

# 7. Create develop branch
git checkout -b develop
git push -u origin develop

# 8. Verify on GitHub
# Visit https://github.com/your-username/newa-epm
```

---

For more help: https://docs.github.com/en
