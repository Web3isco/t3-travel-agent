# T3 Travel Agent - Agent Auth SDK Bounty

A confidential AI travel booking agent built on **Terminal 3's Agent Dev Kit**. Searches and books flights/hotels inside a TEE with verifiable identity, scoped delegation, and PII-safe execution.

## Agent Auth SDK Integration

| Feature | Implementation |
|---------|---------------|
| **Agent DID** | Agent authenticated via T3N with `did:t3n` identity |
| **Scoped Delegation** | `agent-auth-update` grants function-level permissions |
| **Spending Mandate** | Hard-coded limits enforced in TEE contract |
| **Egress Control** | Only `api.terminal3.io` allowed on grant |
| **PII Protection** | `http-with-placeholders` keeps user data out of WASM |
| **Function Scoping** | 4 functions individually authorized |
| **Revocation** | `agent-auth-update` with revoke list |

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Travel Agent   │────▶│  T3N TEE Contract    │────▶│  Travel API  │
│  (TypeScript)   │     │  (Rust → WASM)       │     │  (Mock/SDK)  │
│                 │     │                      │     │              │
│  - Auth w/ T3N  │     │  search-flights()    │     │  Search      │
│  - Delegation   │     │  search-hotels()     │     │  Booking     │
│  - Budget check │     │  book-flight()       │     │  PII-safe    │
│  - Mandate      │     │  book-hotel()        │     │              │
└─────────────────┘     └──────────────────────┘     └──────────────┘
```

## Project Structure

```
t3-travel-agent/
├── contract/           # Rust TEE contract
│   ├── src/
│   │   ├── lib.rs      # Entry point + WIT bindgen
│   │   ├── search.rs   # Flight & hotel search
│   │   └── booking.rs  # PII-safe booking via placeholders
│   ├── wit/
│   │   ├── world.wit   # WIT interface
│   │   └── deps/       # Host interface packages
│   └── Cargo.toml
├── agent/              # TypeScript agent
│   ├── src/
│   │   ├── authz.ts    # Agent Auth SDK (delegation, grants)
│   │   ├── travel-agent.ts  # Agent business logic
│   │   ├── setup.ts    # Tenant + contract registration
│   │   └── demo.ts     # End-to-end demo
│   ├── package.json
│   └── .env.example
├── .github/workflows/  # CI build
└── README.md
```

## Quick Start

### 1. Claim T3N Test Tokens

- Go to [terminal3.io/claim-page](https://www.terminal3.io/claim-page)
- Sign in with Google
- Copy your API key

### 2. Build the TEE Contract

```bash
# Linux/macOS (or via CI):
cd contract
rustup target add wasm32-wasip2
cargo build --release --target wasm32-wasip2
```

### 3. Set Up the Agent

```bash
cd agent
cp .env.example .env
# Edit .env with your T3N_API_KEY

npm install
npm run setup     # Register contract + seed secrets
npm run demo      # Run the agent demo
```

### 4. Watch the Flow

The demo shows:

1. ✅ T3N authentication (DID creation)
2. ✅ Tenant identity claim
3. ✅ Token balance check
4. ✅ Secrets map creation
5. ✅ **Agent Auth delegation** (scoped grant with spending limit)
6. ✅ Flight search (via TEE contract)
7. ✅ Hotel search
8. ✅ Budget-aware booking (within mandate)
9. ✅ PII-safe execution (placeholders)

## Dependencies

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://rustup.rs/) with `wasm32-wasip2` target
- [T3N Test Tokens](https://www.terminal3.io/claim-page) (free)

## Agent Auth Grant Example

```typescript
const grant = {
  agents: [{
    agentDid: "did:t3n:...",
    scripts: [{
      scriptName: "z:<tid>:travel-contracts",
      functions: ["search-flights", "search-hotels", "book-flight", "book-hotel"],
      allowedHosts: ["api.terminal3.io"],
    }],
  }],
  mandate: {
    maxSpending: 5000,
    currency: "USD",
    allowedDestinations: ["JFK", "LHR", "NRT", "SIN"],
    maxBookingAmount: 2000,
  },
};
```

## License

MIT
