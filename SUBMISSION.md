# Submission - Terminal 3 Agent Dev Kit Bounty

## What We Built

**T3 Travel Agent** — a confidential AI agent that searches and books flights/hotels inside a TEE, with verifiable identity, scoped delegation, and PII-safe execution.

### Agent Auth SDK Integration
- `agent-auth-update` for scoped function-level delegation
- Spending mandate (limit, currency, destinations, per-booking cap)
- Egress allowlist (only `api.terminal3.io`)
- PII protection via `http-with-placeholders`
- DID-based agent identity on T3N

## Files to Submit

1. **GitHub Repo** — push `t3-travel-agent/` to GitHub
2. **Demo Video** — screen recording (2-3 min)

## Steps You Need to Run

### 1. Create GitHub Repo
```bash
# Go to github.com/new, create "t3-travel-agent" (public)
cd t3-travel-agent
git remote add origin https://github.com/YOUR_USER/t3-travel-agent.git
git push -u origin main
```

GitHub Actions will auto-build the WASM contract. Wait ~2 min, then download from Actions tab.

### 2. Get T3N API Key
- Go to **https://www.terminal3.io/claim-page**
- Sign in with Google
- Copy your API key (save it permanently)

### 3. Install npm packages
```bash
cd agent
npm install
```
(This will take a while on slow networks — let it run)

### 4. Set up env
```bash
cd agent
cp .env.example .env
# Edit .env and paste your T3N_API_KEY
```

### 5. Run setup (register contract)
```bash
cd agent
npx tsx src/setup.ts
```

### 6. Run demo
```bash
cd agent
npx tsx src/demo.ts
```

### 7. Record demo video (2-3 min)
Show:
- T3N auth (DID created)
- Agent Auth delegation (scoped grant with spending limits)
- Flight search → booking flow
- Budget enforcement

### 8. Submit on DoraHacks
- Upload GitHub link
- Upload demo video
- Submit any bugs/docs gaps found as bonus
