import {
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  T3nClient,
  createEthAuthInput,
  TenantClient,
  getNodeUrl,
} from "@terminal3/t3n-sdk";
import { readFile } from "fs/promises";
import { resolve } from "path";

setEnvironment("testnet");

const API_KEY = process.env.T3N_API_KEY;
if (!API_KEY) {
  console.error("T3N_API_KEY required");
  process.exit(1);
}

async function main() {
  const CONTRACT_TAIL = "travel-contracts";
  const CONTRACT_VERSION = "0.1.0";
  const WASM_PATH = resolve("..", "contract", "target", "wasm32-wasip2", "release", "z_travel_agent.wasm");

  // 1. Authenticate
  console.log("1. Authenticating...");
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(API_KEY);
  const client = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, API_KEY) },
  });
  await client.handshake();
  const did = await client.authenticate(createEthAuthInput(address));
  const userDid = did.toString();
  console.log(`   DID: ${userDid}`);

  // 2. Become dev tenant on testnet
  console.log("2. Becoming dev tenant...");
  try {
    await client.submitUserInput({
      profile: { email_address: "dev@travel-agent.demo" },
      becomeDevTenant: true,
    });
    console.log("   Dev tenant admitted");
  } catch (e) {
    console.log("   Already a dev tenant or skipped");
  }

  // 3. Get tenant info
  console.log("3. Getting tenant info...");
  const tenantDid = userDid;
  const nodeUrl = getNodeUrl();
  const tenant = new TenantClient({ t3n: client, tenantDid, baseUrl: nodeUrl });
  const tenantInfo = await tenant.tenant.me();
  const tenantName = typeof tenantInfo === "object" && tenantInfo !== null ? (tenantInfo as Record<string, unknown>).tenant as string : tenantDid;
  console.log(`   Tenant: ${tenantName}`);
  console.log(`   Status: ${(tenantInfo as Record<string, unknown>).status}`);

  // 4. Register contract
  console.log("4. Registering TEE contract...");
  let wasmBytes: Uint8Array;
  try {
    wasmBytes = await readFile(WASM_PATH);
  } catch {
    console.log("   WASM not found — skipping contract registration. Push to GitHub to trigger CI build.");
    console.log("\n=== Setup Partially Complete ===");
    console.log(`Tenant DID: ${tenantDid}`);
    process.exit(0);
  }
  const result = await tenant.contracts.register({
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasm: wasmBytes,
  });
  const contractId = typeof result === "object" && result !== null ? (result as Record<string, unknown>).contract_id as string : "unknown";
  console.log(`   Contract registered: ${tenantName}:${CONTRACT_TAIL} (id: ${contractId})`);

  // 4. Create secrets map
  console.log("4. Creating secrets map...");
  try {
    await tenant.maps.create({
      tail: "secrets",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("   Secrets map created");
  } catch (e) {
    console.log("   Secrets map already exists");
  }

  // 5. Create travel data maps
  console.log("5. Creating travel data maps...");
  try {
    await tenant.maps.create({
      tail: "travel-data",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("   Travel data maps created");
  } catch (e) {
    console.log("   Travel data maps already exist");
  }

  // 6. Seed API key
  console.log("6. Seeding API key...");
  try {
    const scriptName = `${tenantName}:contracts`;
    await client.execute({
      script_name: scriptName,
      function_name: "map-entry-set",
      input: {
        map_name: `${tenantName}:secrets`,
        key: "travel_api_key",
        value: API_KEY,
      },
    });
    console.log("   API key seeded");
  } catch (e) {
    console.log("   API key seeding skipped or already exists");
  }

  console.log("\n=== Setup Complete ===");
  console.log(`Tenant: ${tenantName}`);
  console.log(`Contract: ${tenantName}:${CONTRACT_TAIL} (id: ${contractId})`);
}

main().catch(console.error);
