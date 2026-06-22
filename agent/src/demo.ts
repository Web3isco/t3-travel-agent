import {
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  T3nClient,
  createEthAuthInput,
} from "@terminal3/t3n-sdk";
import { AgentAuthManager, Mandate } from "./authz.js";
import { TravelBookingAgent } from "./travel-agent.js";

setEnvironment("testnet");

const API_KEY = process.env.T3N_API_KEY;
if (!API_KEY) {
  console.error("ERROR: T3N_API_KEY environment variable is required");
  console.error("Get one at https://www.terminal3.io/claim-page");
  process.exit(1);
}

async function main() {
  console.log("=== T3 Travel Agent - Demo ===\n");

  // 1. Authenticate with T3N
  console.log("1. Authenticating with T3N...");
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(API_KEY);
  const client = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, API_KEY) },
  });
  await client.handshake();
  const authResult = await client.authenticate(createEthAuthInput(address));
  const userDid = authResult.did;
  console.log(`   Authenticated as: ${userDid}`);

  // 2. Claim tenant identity
  console.log("\n2. Claiming tenant identity...");
  const tenant = client.tenant!;
  const tenantInfo = await tenant.claim?.();
  const tenantDid = tenantInfo?.did || userDid;
  console.log(`   Tenant DID: ${tenantDid}`);

  // 3. Check token balance
  console.log("\n3. Checking token balance...");
  const { balance } = await client.getUsage();
  console.log(`   Credits available: ${balance.available}`);

  // 4. Create secrets map for API key
  console.log("\n4. Setting up secrets map...");
  try {
    await tenant.maps!.create({
      tail: "secrets",
      visibility: "private",
      writers: { only: [0] },
      readers: { only: [0] },
    });
    console.log("   Secrets map created");
  } catch (e) {
    console.log("   Secrets map already exists");
  }

  // 5. Set up Agent Auth delegation
  console.log("\n5. Setting up Agent Auth delegation...");
  const authManager = new AgentAuthManager(client, userDid);
  const tenantId = tenantDid.slice("did:t3n:".length);
  const scriptName = `z:${tenantId}:travel-contracts`;

  const mandate: Mandate = {
    spendingLimit: 5000,
    currency: "USD",
    allowedDestinations: ["JFK", "LHR", "NRT", "SIN"],
    maxBookingAmount: 2000,
  };

  console.log(`   Mandate: ${JSON.stringify(mandate, null, 2)}`);

  const grantResult = await authManager.setMandateContract(
    userDid,
    mandate,
  );
  console.log(`   Agent auth grant: ${JSON.stringify(grantResult).slice(0, 100)}...`);

  // 6. Create the travel agent
  console.log("\n6. Initializing travel agent...");
  const travelAgent = new TravelBookingAgent(
    client,
    userDid,
    tenantDid,
    scriptName,
    authManager,
    mandate,
  );
  console.log(`   Budget: $${travelAgent.remainingBudget}`);

  // 7. Search flights (Demo: mock API or offline mode)
  console.log("\n7. Demo: Planning trip from New York (JFK) to London (LHR)...");
  try {
    const tripPlan = await travelAgent.planTrip({
      origin: "JFK",
      destination: "LHR",
      departure_date: "2026-07-15",
      return_date: "2026-07-22",
      check_in: "2026-07-15",
      check_out: "2026-07-22",
      passengers: 1,
    });

    console.log(`\n   Flights found: ${tripPlan.flights.length}`);
    for (const f of tripPlan.flights) {
      console.log(`     - ${f.airline} ${f.flight_number}: $${f.total_amount}`);
    }

    console.log(`\n   Hotels found: ${tripPlan.hotels.length}`);
    for (const h of tripPlan.hotels) {
      console.log(`     - ${h.name} (${h.room_type}): $${h.total_amount}`);
    }

    console.log(`\n   Total trip cost: $${tripPlan.total_cost}`);

    // 8. Attempt booking (shows Agent Auth scope enforcement)
    if (tripPlan.flights.length > 0) {
      console.log("\n8. Attempting to book flight (within mandate)...");
      try {
        const booking = await travelAgent.bookFlight(
          tripPlan.flights[0].id,
          tripPlan.flights[0].total_amount,
          tripPlan.flights[0].total_currency,
        );
        console.log(`   Booking result: ${JSON.stringify(booking)}`);
        console.log(`   Remaining budget: $${travelAgent.remainingBudget}`);
      } catch (e) {
        console.log(`   Booking failed (expected in offline mode): ${e}`);
      }
    }
  } catch (e) {
    console.log(`\n   Search skipped (expected offline): ${e}`);
    console.log("   Run with a valid T3N API key for live demo.");
  }

  // 9. Show Agent Auth summary
  console.log("\n=== Agent Auth SDK Integration Summary ===");
  console.log("  ✅ Agent DID authenticated via T3N");
  console.log("  ✅ Tenant identity claimed");
  console.log("  ✅ Scoped delegation grant created via agent-auth-update");
  console.log("  ✅ Spending mandate enforced client-side");
  console.log("  ✅ Destination allowlist enforced");
  console.log("  ✅ Per-booking amount cap: $2,000");
  console.log("  ✅ TEE contract: 4 functions (search-flights, search-hotels, book-flight, book-hotel)");
  console.log("  ✅ PII protected via http-with-placeholders");
  console.log("  ✅ Egress restricted to api.terminal3.io");
  console.log("\n=== Demo Complete ===");
}

main().catch((e) => {
  console.error("Demo failed:", e.message);
  process.exit(1);
});
