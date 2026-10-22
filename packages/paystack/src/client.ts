export type PaystackInitArgs = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export function createPaystackClient(secretKey: string, fetchImpl: typeof fetch = fetch) {
  const base = "https://api.paystack.co";
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  return {
    async initializeTransaction(args: PaystackInitArgs) {
      const res = await fetchImpl(`${base}/transaction/initialize`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: args.email,
          amount: args.amountKobo,
          reference: args.reference,
          callback_url: args.callbackUrl,
          currency: "NGN",
          metadata: args.metadata,
        }),
      });
      const json = (await res.json()) as {
        status: boolean;
        data?: { authorization_url: string; access_code: string; reference: string };
        message?: string;
      };
      if (!json.status || !json.data) throw new Error(json.message ?? "Paystack init failed");
      return json.data;
    },
    async verifyTransaction(reference: string) {
      const res = await fetchImpl(`${base}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers,
      });
      return res.json() as Promise<{
        status: boolean;
        data?: {
          status: string;
          amount: number;
          reference: string;
          channel?: string;
          fees?: number;
          paid_at?: string;
        };
      }>;
    },
  };
}
