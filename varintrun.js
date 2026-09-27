// varintrun.js：按处理预算处理事件，处理不完的连着载压在账上；收尾不限预算清账
import { encodeVarint, decodeOne } from "./varint.js";

function errorWith(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw errorWith("E_BAD_EVENT", "事件必须是对象");
  }
  if (event.kind === "encode") {
    if (!Number.isInteger(event.value) || event.value < 0) {
      throw errorWith("E_BAD_EVENT", "encode 事件需要非负整数 value");
    }
    return;
  }
  if (event.kind === "decode") {
    if (!Number.isInteger(event.count) || event.count < 1) {
      throw errorWith("E_BAD_EVENT", "decode 事件需要正整数 count");
    }
    return;
  }
  throw errorWith("E_BAD_EVENT", "未知事件类型 " + String(event.kind));
}

function cloneState(state) {
  return {
    wire: String(state && state.wire ? state.wire : ""),
    numbers: (state && state.numbers ? state.numbers : []).slice(),
    missed: (state && state.missed ? state.missed : []).slice(),
    ledger: (state && state.ledger ? state.ledger : []).map((row) => row.slice()),
    applied: (state && state.applied ? state.applied : []).slice()
  };
}

function applyRow(state, row, maxBytes) {
  const kind = row[0];
  const arg = row[1];
  if (kind === "encode") {
    state.wire += encodeVarint(arg, maxBytes);
    return;
  }
  if (kind === "decode") {
    let need = arg;
    while (need > 0) {
      const got = decodeOne(state.wire, maxBytes);
      if (got.value < 0) break;
      state.numbers.push(got.value);
      state.wire = state.wire.slice(got.used * 2);
      need -= 1;
    }
    if (need > 0) state.missed.push(need);
    return;
  }
  throw errorWith("E_BAD_EVENT", "账上条目类型不合法 " + String(kind));
}

function runQueue(state, queue, budget, maxBytes) {
  let served = 0;
  let cursor = 0;
  while (cursor < queue.length && served < budget) {
    applyRow(state, queue[cursor], maxBytes);
    served += 1;
    cursor += 1;
  }
  return { served, rest: queue.slice(cursor) };
}

export function step(spec) {
  const events = spec.events || [];
  events.forEach(validateEvent);
  const state = cloneState(spec.state);
  const budget = Math.max(0, Math.floor(spec.budget || 0));
  const maxBytes = spec.max_bytes;
  const queue = state.ledger.slice();
  state.ledger = [];
  const freshIds = [];
  for (const event of events) {
    const id = event.id;
    if (id !== undefined && state.applied.indexOf(id) !== -1) continue;
    queue.push(event.kind === "encode" ? ["encode", event.value] : ["decode", event.count]);
    if (id !== undefined) freshIds.push(id);
  }
  const judged = queue.length;
  const judgedBound = judged + (events.length - freshIds.length);
  const outcome = runQueue(state, queue, budget, maxBytes);
  state.ledger = outcome.rest;
  state.applied = state.applied.concat(freshIds);
  return {
    state,
    served: outcome.served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map((row) => row.slice()),
    judged,
    judged_bound: judgedBound
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const queue = state.ledger.slice();
  state.ledger = [];
  const outcome = runQueue(state, queue, queue.length, spec.max_bytes);
  state.ledger = outcome.rest;
  return { state, catchup: outcome.served };
}
