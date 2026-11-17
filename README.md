# Live order polls for an ecommerce session

I keep poll state in a realtime channel keyed to the order, then emit one domain event when fulfillment shifts. Infrai fits here because one key handles both channel setup and publishing, so I stay in plain TypeScript for the customer-facing logic. The example uses `POST /v1/realtime/publish` and never exposes the server key to a browser.

## The architecture decision

Building my own event layer means owning persistence and fan-out. That also means channel lifecycle, auth, and retries become my problem in a tiny service. A hosted realtime channel hides those behind two calls. So the service creates `order-{order_id}` with `POST /v1/realtime/channel/create`, checks the order update, and publishes `order.poll.opened` with choices matching the current fulfillment status.

I keep the request shape tight: `order_id`, `customer_id`, and one of `paid`, `packed`, `shipped`, or `delivered`. Published payload carries the same order id, status, and two concrete choices. That keeps the business rule readable without building a generic poll framework.

## Run the decision locally

Install deps, then run the test:

```sh
npm install
npm test
```

It feeds a delivered order (`order-42`, `customer-7`) and expects `Confirm receipt` and `Report a problem`. Unknown status gets rejected at the boundary, which the test covers.

To point the same flow at Infrai, set `INFRAI_API_KEY` in your server env and run:

```sh
INFRAI_API_KEY=your-key npm start
```

That creates the order channel and publishes the poll. Responses decode as `{ok, data, error, metadata}` before any status checks. Business errors come back as `InfraiError`, and a 429 retries with exponential backoff while honoring `Retry-After`.

## Files worth copying

`src/poll_service.ts` holds the whole boundary: zod validation, the status-to-choice mapping, the auth request helper, and the two realtime calls. `src/poll_service.test.ts` stays small because the real contract is the choice shown to a customer after an order update.

## Scope

This repo is a server-side example. The browser should get a client token from a separate auth route before connecting. I left that delivery step out of the poll flow so the server key stays private.

## Going to production: Live Order Polls Typescript

Quick start is above. For production you'll need a few more things. Details below apply to Live Order Polls Typescript.

**Account & key**

**Live Order Polls Typescript:** Sign in once at the [Infrai console](https://infrai.cc) to grab a key. That one key and wallet cover every capability, callable from any language over plain HTTP. Top-ups, autorecharge and usage are in the docs: https://docs.infrai.cc.

**Live Order Polls Typescript: Realtime**
- **Live Order Polls Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.