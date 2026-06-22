import {
  T3nClient,
  loadWasmComponent,
  setEnvironment,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
  getScriptVersion,
  getNodeUrl,
  TenantClient,
} from "@terminal3/t3n-sdk";

setEnvironment("testnet");

export interface ScriptGrant {
  scriptName: string;
  versionReq?: string;
  functions?: string[];
  allowedHosts?: string[];
}

export interface AgentGrant {
  agentDid: string;
  scripts: ScriptGrant[];
}

export interface Mandate {
  spendingLimit: number;
  currency: string;
  allowedDestinations: string[];
  maxBookingAmount: number;
}

export class AgentAuthManager {
  private userClient: T3nClient;
  private userDid: string;

  constructor(userClient: T3nClient, userDid: string) {
    this.userClient = userClient;
    this.userDid = userDid;
  }

  async grantAgentAccess(
    agentDid: string,
    scriptName: string,
    functions: string[],
    allowedHosts: string[],
  ): Promise<string> {
    const userContractVersion = await getScriptVersion(
      getNodeUrl(),
      "tee:user/contracts",
    );

    const grant: AgentGrant = {
      agentDid,
      scripts: [
        {
          scriptName,
          functions,
          allowedHosts,
        },
      ],
    };

    const result = await this.userClient.execute({
      script_name: "tee:user/contracts",
      script_version: userContractVersion,
      function_name: "agent-auth-update",
      input: { agents: [grant] },
    });

    return result;
  }

  async setMandateContract(agentDid: string, mandate: Mandate): Promise<string> {
    const userContractVersion = await getScriptVersion(
      getNodeUrl(),
      "tee:user/contracts",
    );

    const mandateGrant: AgentGrant = {
      agentDid,
      scripts: [
        {
          scriptName: "tee:user/contracts",
          functions: ["agent-auth-update"],
          allowedHosts: [],
        },
        {
          scriptName: `z:${this.userDid.slice("did:t3n:".length)}:travel-contracts`,
          functions: ["search-flights", "search-hotels", "book-flight", "book-hotel"],
          allowedHosts: ["api.terminal3.io"],
        },
      ],
    };

    const result = await this.userClient.execute({
      script_name: "tee:user/contracts",
      script_version: userContractVersion,
      function_name: "agent-auth-update",
      input: {
        agents: [mandateGrant],
        mandate: {
          maxSpending: mandate.spendingLimit,
          currency: mandate.currency,
          allowedDestinations: mandate.allowedDestinations,
          maxBookingAmount: mandate.maxBookingAmount,
        },
      },
    });

    return result;
  }

  async revokeAgentAccess(agentDid: string): Promise<string> {
    const userContractVersion = await getScriptVersion(
      getNodeUrl(),
      "tee:user/contracts",
    );

    const result = await this.userClient.execute({
      script_name: "tee:user/contracts",
      script_version: userContractVersion,
      function_name: "agent-auth-update",
      input: { agents: [], revoke: [agentDid] },
    });

    return result;
  }

  static buildAgentAuthUpdateInput(params: {
    agentDid: string;
    scripts: ScriptGrant[];
  }): Record<string, unknown> {
    return {
      agents: [
        {
          agentDid: params.agentDid,
          scripts: params.scripts.map((s) => ({
            scriptName: s.scriptName,
            ...(s.versionReq ? { versionReq: s.versionReq } : {}),
            ...(s.functions ? { functions: s.functions } : {}),
            ...(s.allowedHosts ? { allowedHosts: s.allowedHosts } : {}),
          })),
        },
      ],
    };
  }
}

export async function createAuthenticatedClients(apiKey: string): Promise<{
  agentClient: T3nClient;
  userClient: T3nClient;
  agentDid: string;
  userDid: string;
}> {
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const agentClient = new T3nClient({
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
  });

  await agentClient.handshake();
  const authResult = await agentClient.authenticate(createEthAuthInput(address));

  const userClient = agentClient;

  return {
    agentClient,
    userClient,
    agentDid: authResult.did,
    userDid: authResult.did,
  };
}
