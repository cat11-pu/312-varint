import { encodeVarint, decodeOne } from "./varint.js";

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function pairOf(event) {
  if (event.kind === "encode") return ["encode", event.value];
  return ["decode", event.count];
}

function validateEvents(events) {
  if (!Array.isArray(events)) throw makeError("E_BAD_EVENT", "events 必须是数组");
  for (const event of events) {
    if (!event || typeof event !== "object") throw makeError("E_BAD_EVENT", "事件必须是对象");
    if (event.kind === "encode") {
      if (typeof event.value !== "number" || !Number.isInteger(event.value) || event.value < 0) {
        throw makeError("E_BAD_EVENT", "encode 事件必须带非负整数 value");
      }
    } else if (event.kind === "decode") {
      if (typeof event.count !== "number" || !Number.isInteger(event.count) || event.count <= 0) {
        throw makeError("E_BAD_EVENT", "decode 事件必须带正整数 count");
      }
    } else {
      throw makeError("E_BAD_EVENT", "未知事件类型：" + String(event && event.kind));
    }
  }
}

function cloneState(state) {
  state = state || {};
  return {
    wire: typeof state.wire === "string" ? state.wire : "",
    numbers: Array.isArray(state.numbers) ? state.numbers.slice() : [],
    missed: Array.isArray(state.missed) ? state.missed.slice() : [],
    ledger: Array.isArray(state.ledger) ? state.ledger.map(function (row) { return row.slice(); }) : [],
    applied: Array.isArray(state.applied) ? state.applied.slice() : []
  };
}

function runPair(state, pair, maxBytes) {
  if (pair[0] === "encode") {
    state.wire += encodeVarint(pair[1], maxBytes);
  } else {
    let need = pair[1];
    while (need > 0) {
      const got = decodeOne(state.wire, maxBytes);
      if (got.value === -1 && got.used === 0) break;
      state.numbers.push(got.value);
      state.wire = state.wire.slice(got.used * 2);
      need -= 1;
    }
    if (need > 0) state.missed.push(need);
  }
}

export function step(spec) {
  const events = spec.events || [];
  validateEvents(events);

  const maxBytes = spec.max_bytes;
  const budget = typeof spec.budget === "number" ? spec.budget : 0;
  const state = cloneState(spec.state);
  const applied = state.applied;

  // 本轮队列：先还上轮留下的账（紧凑二元组），再接新事件；已处理过的事件直接跳过。
  const queue = state.ledger.map(function (row) { return { pair: row.slice() }; });
  state.ledger = [];
  const admittedIds = [];
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(event, "id") && applied.indexOf(event.id) !== -1) continue;
    const hasId = Object.prototype.hasOwnProperty.call(event, "id");
    queue.push({ pair: pairOf(event), id: hasId ? event.id : undefined });
    if (hasId) admittedIds.push(event.id);
  }

  let served = 0;
  for (const item of queue) {
    if (served < budget) {
      runPair(state, item.pair, maxBytes);
      served += 1;
    } else {
      state.ledger.push(item.pair);
    }
  }
  for (const id of admittedIds) {
    if (applied.indexOf(id) === -1) applied.push(id);
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: served,
    judged_bound: queue.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const pair of pending) {
    runPair(state, pair, spec.max_bytes);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
