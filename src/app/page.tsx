import { SwapInterface } from "@/components/SwapInterface";

export default function HomePage() {
  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Cross-chain stablecoin routes for{" "}
          <span className="text-bch">Bitcoin Cash</span>
        </h1>
        <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
          Discover and validate executable routes between MUSD / PUSD
          (CashTokens) and USDT on Ethereum & BNB Smart Chain. Non-custodial.
          Provider-backed. Honest about what works.
        </p>
      </div>
      <SwapInterface />
    </div>
  );
}
