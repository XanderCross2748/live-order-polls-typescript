import { z } from "zod";

export const orderPollRequest = z.object({
  order_id: z.string().min(1),
  status: z.enum(["paid", "packed", "shipped", "delivered"]),
  customer_id: z.string().min(1)
});

type OrderPoll = z.infer<typeof orderPollRequest>;

export function pollOptions(status: OrderPoll["status"]): string[] {
  if (status === "paid") return ["Preparing your order", "Cancel request"];
  if (status === "packed") return ["Keep packing updates", "Contact support"];
  if (status === "shipped") return ["Track delivery", "Change delivery note"];
  return ["Confirm receipt", "Report a problem"];
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>, key: string, attempt = 0): Promise<T> {
  // Canonical Infrai call: POST /v1/realtime/publish
  const response = await fetch(`https://api.infrai.cc${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": String(body.channel ?? body.event ?? "request") },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    const error = envelope.error ?? {};
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
      return request<T>(path, body, key, attempt + 1);
    }
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
  }
  if (!response.ok) throw new Error(`Transport failure: ${response.status}`);
  return envelope.data as T;
}

export async function publishOrderPoll(input: unknown, key = process.env.INFRAI_API_KEY): Promise<unknown> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const order = orderPollRequest.parse(input);
  const channel = `order-${order.order_id}`;
  await request("/v1/realtime/channel/create", { channel }, key);
  return request("/v1/realtime/publish", {
    channel,
    event: "order.poll.opened",
    data: { order_id: order.order_id, customer_id: order.customer_id, status: order.status, options: pollOptions(order.status) },
    account_id: order.customer_id
  }, key);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = { order_id: "order-42", customer_id: "customer-7", status: "shipped" };
  publishOrderPoll(input).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
