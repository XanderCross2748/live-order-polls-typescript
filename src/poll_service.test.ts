import assert from "node:assert/strict";
import { orderPollRequest, pollOptions } from "./poll_service.ts";

const order = orderPollRequest.parse({ order_id: "order-42", customer_id: "customer-7", status: "delivered" });
assert.deepEqual(pollOptions(order.status), ["Confirm receipt", "Report a problem"]);
assert.throws(() => orderPollRequest.parse({ order_id: "order-42", customer_id: "customer-7", status: "returned" }));
console.log("poll decision test passed");
