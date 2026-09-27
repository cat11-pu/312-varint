// varint.js：变长整数 LEB128 编解码（七位一组，低位在前，续位置于最高位）

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function encodeVarint(value, maxBytes) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw makeError("E_TOO_BIG", "value 必须是非负整数");
  }
  if (typeof maxBytes !== "number" || !Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw makeError("E_TOO_BIG", "maxBytes 必须是正整数");
  }
  const maxValue = Math.pow(2, 7 * maxBytes) - 1;
  if (value > maxValue) {
    throw makeError("E_TOO_BIG", "value 超过 " + maxBytes + " 字节能表示的上限 " + maxValue);
  }
  let out = "";
  let rest = value;
  do {
    let byte = rest % 128;
    rest = Math.floor(rest / 128);
    if (rest !== 0) byte |= 0x80;
    out += byte.toString(16).padStart(2, "0");
  } while (rest !== 0);
  return out;
}

export function decodeOne(wire, maxBytes) {
  const text = wire || "";
  let value = 0;
  for (let i = 0; i < maxBytes; i++) {
    if (text.length < (i + 1) * 2) {
      return { value: -1, used: 0 };
    }
    const byte = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    value += (byte & 0x7f) * Math.pow(128, i);
    if ((byte & 0x80) === 0) {
      return { value: value, used: i + 1 };
    }
  }
  throw makeError("E_OVERLONG", "读满 " + maxBytes + " 个字节仍带着续位标记");
}
