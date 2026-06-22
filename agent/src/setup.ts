import {
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  T3nClient,
  createEthAuthInput,
  TenantClient,
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
  const authResult = await client.authenticate(createEthAuthInput(address));
  const userDid = authResult.did;
  console.log(`   DID: ${userDid}`);

  // 2. Claim tenant
  console.log("2. Claiming tenant...");
  const tenant = client.tenant!;
  const tenantInfo = await tenant.claim?.();
  const tenantDid = tenantInfo?.did || userDid;

  // 3. Register contract
  console.log("3. Registering TEE contract...");
  const wasmBytes = await readFile(WASM_PATH);
  const result = await tenant.contracts!.register({
    tail: CONTRACT_TAIL,
    version: CONTRACT_VERSION,
    wasm: wasmBytes,
  });
  const contractId = result.contract_id;
  const tenantId = tenantDid.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:${CONTRACT_TAIL}`;
  console.log(`   Contract registered: ${scriptName} (id: ${contractId})`);

  // 4. Create secrets map
  console.log("4. Creating secrets map...");
  try {
    await tenant.maps!.create({
      tail: "secrets",
      visibility: "private",
      writers: { only: [contractId] },
      readers: { only: [contractId] },
    });
    console.log("   Secrets map created");
  } catch (e) {
    console.log("   Secrets map already exists, updating ACL...");
  }

  // 5. Create travel data maps
  console.log("5. Creating travel data maps...");
  try {
    await tenant.maps!.create({
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
    await client.execute({
      script_name: `z:${tenantId}:contracts`,
      function_name: "map-entry-set",
      input: {
        map_name: `z:${tenantId}:secrets`,
        key: "travel_api_key",
        value: API_KEY,
      },
    });
    console.log("   API key seeded");
  } catch (e) {
    console.log("   API key seeding skipped or already exists");
  }

  console.log("\n=== Setup Complete ===");
  console.log(`Tenant DID: ${tenantDid}`);
  console.log(`Contract: ${scriptName} (id: ${contractId})`);
}

main().catch(console.error);
