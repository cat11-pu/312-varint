// varint.js：变长整数的编解码（基线：一律给空串与负一）
export function encodeVarint(value, maxBytes) {
  return "";
}

export function decodeOne(wire, maxBytes) {
  return { value: -1, used: 0 };
}
