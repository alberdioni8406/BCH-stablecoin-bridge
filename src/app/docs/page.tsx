export default function DocsPage() {
  return (
    <article className="max-w-3xl text-gray-300 space-y-8">
      <h1 className="text-2xl font-bold text-white">Documentation & Risk Disclosure</h1>
      <section>
        <h2 className="text-lg font-semibold text-bch mb-2">What this app is</h2>
        <p className="leading-relaxed">
          BCH StableBridge is a non-custodial route coordinator. It discovers quotes and
          transaction-building instructions from existing providers (primarily THORChain for
          cross-chain legs and Cauldron for BCH-native CashToken swaps). It does not operate a
          bridge contract, wrapped token, custodial wallet, or application treasury.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-bch mb-2">Risks</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Provider risk:</strong> Settlement depends on THORChain vaults, Cauldron pool contracts, and network conditions.</li>
          <li><strong>Non-atomic multi-step execution:</strong> Routes such as ETH.USDT → BCH → PUSD consist of independent legs. If the second leg fails after the first succeeds, you hold the intermediate asset (BCH).</li>
          <li><strong>Price impact & fees:</strong> Pool depth on both THORChain and Cauldron can produce significant slippage for larger amounts.</li>
          <li><strong>Quote expiry:</strong> THORChain quotes and inbound addresses must not be reused after expiry.</li>
          <li><strong>Wallet compatibility:</strong> CashToken legs require a BCH wallet that can sign and broadcast CashToken + covenant spends.</li>
          <li><strong>No redemption guarantee:</strong> This application does not guarantee token redemption, liquidity, or settlement finality beyond what the underlying protocols provide.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-bch mb-2">Prototype vs Live</h2>
        <p>
          <code className="text-bch">NEXT_PUBLIC_APP_MODE=prototype</code> shows clearly labelled
          sample quotes. <code className="text-bch">live</code> attempts real THORChain quotes for
          verified EVM↔BCH pairs. There is no silent fallback from live to fabricated success.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-bch mb-2">Further reading</h2>
        <ul className="list-disc list-inside space-y-1">
          <li><a href="https://dev.thorchain.org/" className="text-bch hover:underline" target="_blank" rel="noreferrer">THORChain developer docs</a></li>
          <li><a href="https://docs.riftenlabs.com/cauldron/" className="text-bch hover:underline" target="_blank" rel="noreferrer">Cauldron / Riften Labs docs</a></li>
          <li><a href="https://paryonusd.com/" className="text-bch hover:underline" target="_blank" rel="noreferrer">ParyonUSD</a></li>
          <li>See <code>docs/PROVIDER_FEASIBILITY.md</code> in the repository for the full Phase 1 investigation report.</li>
        </ul>
      </section>
    </article>
  );
}
