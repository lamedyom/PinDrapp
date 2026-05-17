export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  dealId: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
}

export async function createPaymentIntent(
  payload: CreatePaymentIntentRequest,
): Promise<CreatePaymentIntentResponse> {
  const res = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as CreatePaymentIntentResponse;
}
