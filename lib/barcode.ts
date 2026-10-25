// Minimal Code 128 (code set B) encoder → SVG. Enough for SKU/barcode labels; no dependency.

// Bar/space widths for symbol values 0–106 (106 = stop, 7 elements).
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const STOP = 106;
const QUIET = 10; // modules of white on each side

/** True if the value can be encoded (printable ASCII only). */
export function canEncodeCode128(value: string): boolean {
  return value.length > 0 && value.length <= 48 && /^[\x20-\x7e]+$/.test(value);
}

/** Module widths (alternating bar/space, starting with a bar) for the full symbol. */
export function code128Widths(value: string): number[] {
  if (!canEncodeCode128(value)) throw new Error("Unsupported barcode value");
  const codes = [START_B, ...Array.from(value, (c) => c.charCodeAt(0) - 32)];
  const checksum = codes.reduce((sum, code, i) => sum + code * (i === 0 ? 1 : i), 0) % 103;
  return [...codes, checksum, STOP].flatMap((code) => Array.from(PATTERNS[code], Number));
}

/** SVG markup of the barcode (bars only; print the human-readable text separately). */
export function code128Svg(value: string, { height = 40, moduleWidth = 1 } = {}): string {
  const widths = code128Widths(value);
  const total = widths.reduce((a, b) => a + b, 0) + QUIET * 2;
  let x = QUIET;
  let rects = "";
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`;
    x += w;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="${total * moduleWidth}" height="${height}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}
