import assert from "node:assert";
import { encodeVarint, decodeOne } from "../varint.js";
import { step, close } from "../varintrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, max_bytes: 3,
  state: { wire: "", numbers: [], missed: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "encode", value: 1 }],
  overlong_error_code: "E_OVERLONG", value_error_code: "E_TOO_BIG",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("encodeVarint returns a string", () => {
  assert.strictEqual(typeof encodeVarint(1, 3), "string");
});

check("decodeOne returns value and used", () => {
  const got = decodeOne("05", 3);
  assert.strictEqual(typeof got.value, "number");
  assert.strictEqual(typeof got.used, "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
