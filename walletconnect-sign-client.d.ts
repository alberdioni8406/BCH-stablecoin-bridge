declare module "@walletconnect/sign-client" {
  export class SignClient {
    static init(opts: unknown): Promise<SignClient>;
    connect(opts: unknown): Promise<{ uri?: string; approval: () => Promise<SessionTypes> }>;
    request(opts: unknown): Promise<unknown>;
    disconnect(opts: unknown): Promise<void>;
  }
  interface SessionTypes {
    topic: string;
    namespaces?: Record<string, { accounts?: string[] }>;
  }
}
