import { plaidConfigured, plaidEnv } from "@/lib/integrations/plaid-client";
import { secretsConfigured } from "@/lib/secrets";

// Every outside service an account can connect, and whether this deployment
// can offer it right now. The /app/integrations page reads only this list, so
// a provider with missing keys shows as "not available yet" rather than as a
// button that fails. Add a provider here when its groundwork exists, not before.

export type ProviderStatus = "available" | "not_configured" | "planned";

export type Provider = {
  key: string;
  name: string;
  what: string;
  status: ProviderStatus;
  /** Shown when not available: what the owner has to do, in plain words. */
  setupNote?: string;
};

export function providers(): Provider[] {
  const plaidReady = plaidConfigured() && secretsConfigured();
  return [
    {
      key: "plaid",
      name: "Bank and card accounts",
      what:
        "Connect business checking, savings and credit cards through Plaid so transactions come in by themselves. Works with most US banks and card issuers.",
      status: plaidReady ? "available" : "not_configured",
      setupNote: plaidReady
        ? plaidEnv() === "sandbox"
          ? "Running in Plaid's test mode: use Plaid's sample bank logins, not a real one."
          : undefined
        : "Needs PLAID_CLIENT_ID, PLAID_SECRET and INTEGRATIONS_KEY set on the server.",
    },
    {
      key: "stripe",
      name: "Card payments from clients",
      what: "Take deposits and balances by card, paid straight to your own Stripe account.",
      status: "planned",
    },
    {
      key: "quickbooks",
      name: "QuickBooks and Xero export",
      what: "Send your books to your accountant's software.",
      status: "planned",
    },
  ];
}
