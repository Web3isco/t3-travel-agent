# T3 Travel Booking Agent — Bounty Submission

## Demo Video

Record a 2-3 minute video showing:

1. Run `cd agent && $env:T3N_API_KEY="<your-key>" && npx tsx src/demo.ts`
2. Show the terminal output:
   - T3N authentication
   - Token balance check (~20 billion credits)
   - Agent Auth delegation via `agent-auth-update` (the key feature)
   - Budget enforcement ($5,000 limit, $2,000 per-booking cap)
   - Destination allowlist (JFK, LHR, NRT, SIN)
   - Mock flight search and booking

## Submission Link

https://dorahacks.io/hackathon/t3adkdevchallenge/detail

## GitHub Repository

https://github.com/Web3isco/t3-travel-agent

## What's Included

### TEE Contract (`contract/`)
- WIT interface with 4 functions: `search-flights`, `search-hotels`, `book-flight`, `book-hotel`
- Rust implementation with `host:interfaces/http` for HTTP calls
- PII-safe booking via `http-with-placeholders`
- Built by GitHub Actions CI (Linux runner, `wasm32-wasip2` target)

### Agent Auth SDK (`agent/`)
- `AgentAuthManager` — wraps `agent-auth-update` with scoped grants, spending mandates
- `TravelBookingAgent` — enforces budget, destination allowlist, per-booking caps
- `setup.ts` — registers contract and creates maps on testnet
- `demo.ts` — end-to-end demo (works with or without deployed contract)

### CI/CD
- `.github/workflows/build.yml` — compiles WASM on Linux push

## Network Dependency

- **T3N API key**: Required for authentication. Get one at https://www.terminal3.io/claim-page
- **npm install**: Requires ~5 min on typical connection (148 packages)
- **TEE contract**: Compiles via GitHub Actions automatically on push

## Quick Start

```bash
cd agent
$env:T3N_API_KEY="0x..."  # from terminal3.io/claim-page
npx tsx src/demo.ts        # run the demo
```

## Contact

Built with T3 Agent Dev Kit (ADK) for the DoraHacks bounty challenge.
