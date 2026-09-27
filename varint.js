// varint.js：变长整数的编解码（低七位在前，续位置于最高位，字节串为两位小写十六进制）
function errorWith(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function encodeVarint(value, maxBytes) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw errorWith("E_TOO_BIG", "只接受非负整数");
  }
  if (typeof maxBytes !== "number" || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw errorWith("E_TOO_BIG", "上限字节数不合法");
  }
  const limit = 2 ** (7 * maxBytes) - 1;
  if (value > limit) {
    throw errorWith("E_TOO_BIG", "数值超过可表示上限 " + limit);
  }
  let remaining = value;
  let out = "";
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    out += byte.toString(16).padStart(2, "0");
  } while (remaining > 0);
  return out;
}

export function decodeOne(wire, maxBytes) {
  let value = 0;
  let shift = 0;
  let index = 0;
  for (;;) {
    const head = index * 2;
    if (head + 2 > wire.length) {
      return { value: -1, used: 0 };
    }
    const byte = parseInt(wire.slice(head, head + 2), 16);
    if (index === maxBytes - 1 && (byte & 0x80)) {
      throw errorWith("E_OVERLONG", "读满上限字节数仍带续位标记");
    }
    value += (byte & 0x7f) * 2 ** shift;
    index += 1;
    if (!(byte & 0x80)) {
      return { value, used: index };
    }
    shift += 7;
  }
}
