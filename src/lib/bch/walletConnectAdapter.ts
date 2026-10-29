/**
 * BCH WalletConnect v2 adapter scaffold.
 *
 * Phase A: structure + connect gate only.
 * Full SignClient session requires:
 *   - NEXT_PUBLIC_WC_PROJECT_ID
 *   - @walletconnect/sign-client (install when enabling)
 *   - wallet that supports bch:bitcoincash (Paytaca, Cashonize, …)
 *
 * Does not store seeds or private keys.
 */
import type {
  BchWalletAdapter,
  BchWalletSession,
  SignTransactionResult,
} from "./types";
import { BCH_WC_ENABLED, BCH_WC_CHAIN, getBchNetwork, WC_PROJECT_ID } from "./config";
import { BCH_WC_METHODS } from "./types";

export class WalletConnectBchAdapter implements BchWalletAdapter {
  readonly id = "walletconnect-bch";
  private session: BchWalletSession | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private topic: string | null = null;

  async connect(): Promise<BchWalletSession> {
    if (!BCH_WC_ENABLED) {
      throw new Error("Set NEXT_PUBLIC_BCH_WC=1 to enable BCH WalletConnect");
    }
    if (!WC_PROJECT_ID) {
      throw new Error(
        "Set NEXT_PUBLIC_WC_PROJECT_ID from https://cloud.walletconnect.com"
      );
    }

    // Dynamic import so production builds without the package still typecheck
    // when flag is off. When flag is on, install: npm i @walletconnect/sign-client
    try {
      const { SignClient } = await import("@walletconnect/sign-client");
      this.client = await SignClient.init({
        projectId: WC_PROJECT_ID,
        metadata: {
          name: "BCH StableBridge",
          description: "Non-custodial BCH stablecoin route coordinator",
          url:
            typeof window !== "undefined"
              ? window.location.origin
              : "https://bch-stablecoin-bridge.vercel.app",
          icons: [],
        },
      });
    } catch (e) {
      throw new Error(
        `WalletConnect SignClient unavailable. Install @walletconnect/sign-client. (${
          e instanceof Error ? e.message : String(e)
        })`
      );
    }

    const network = getBchNetwork();
    const chain = BCH_WC_CHAIN[network];

    const { uri, approval } = await this.client.connect({
      requiredNamespaces: {
        bch: {
          chains: [chain],
          methods: [...BCH_WC_METHODS],
          events: ["addressesChanged"],
        },
      },
    });

    if (uri && typeof window !== "undefined") {
      // Caller / UI should show QR; for Phase A open URI scheme when possible
      console.info("[BCH-WC] Pairing URI (open in Paytaca/Cashonize):", uri);
      try {
        window.prompt("Copy WalletConnect URI into your BCH wallet:", uri);
      } catch {
        /* ignore */
      }
    }

    const session = await approval();
    this.topic = session.topic as string;

    const accounts: string[] =
      session.namespaces?.bch?.accounts ??
      session.namespaces?.bip122?.accounts ??
      [];
    // accounts look like "bch:bitcoincash:q..."
    const raw = accounts[0] || "";
    const address = raw.includes(":")
      ? raw.split(":").slice(1).join(":") // drop chain prefix once
      : raw;
    // If format is bch:bitcoincash:qxx — take from bitcoincash
    const cashAddr = raw.match(/(bitcoincash|bchtest):[a-z0-9]+/i)?.[0] || address;

    this.session = {
      address: cashAddr,
      connected: true,
      chainId: chain,
      protocol: "walletconnect",
    };
    return this.session;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.topic) {
      try {
        await this.client.disconnect({
          topic: this.topic,
          reason: { code: 6000, message: "User disconnected" },
        });
      } catch {
        /* ignore */
      }
    }
    this.client = null;
    this.topic = null;
    this.session = null;
  }

  getSession(): BchWalletSession | null {
    return this.session;
  }

  async signTransaction(wcTransactionObject: unknown): Promise<SignTransactionResult> {
    if (!this.client || !this.topic || !this.session) {
      return { error: "Not connected" };
    }
    try {
      const result = await this.client.request({
        topic: this.topic,
        chainId: this.session.chainId,
        request: {
          method: "bch_signTransaction",
          params: wcTransactionObject,
        },
      });
      // Wallet responses vary: string hex, or { signedTransaction, signedTransactionHash }
      if (typeof result === "string") {
        return { hex: result };
      }
      if (result && typeof result === "object") {
        const r = result as Record<string, string>;
        return {
          hex: r.signedTransaction || r.hex,
          txid: r.signedTransactionHash || r.txid,
        };
      }
      return { error: "Empty sign response" };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
