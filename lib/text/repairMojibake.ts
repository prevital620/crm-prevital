export function repairMojibake(value: string | null | undefined) {
  const source = value ?? "";
  if (!source) return "";

  let current = source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );

  const suspiciousCodes = new Set([194, 195]);
  const replacementChar = String.fromCharCode(65533);
  const stray194 = String.fromCharCode(194);
  const middleDotPair = `${stray194}${String.fromCharCode(183)}`;

  const looksCorrupted = (text: string) =>
    text.includes("\\u00") ||
    text.includes(replacementChar) ||
    text.includes("Ã") ||
    text.includes("Â") ||
    Array.from(text).some((char) => suspiciousCodes.has(char.charCodeAt(0)));

  const decoder = new TextDecoder("utf-8");

  for (let index = 0; index < 5 && looksCorrupted(current); index += 1) {
    try {
      const bytes = Uint8Array.from(Array.from(current), (char) => char.charCodeAt(0) & 0xff);
      const decoded = decoder.decode(bytes);

      if (!decoded || decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return current.replaceAll(middleDotPair, "·").replaceAll(stray194, "").trim();
}
