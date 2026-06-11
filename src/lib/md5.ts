/**
 * Computes the MD5 hash of an ArrayBuffer and returns its Base64 representation.
 * Used for S3 Content-MD5 payload integrity verification.
 */
export function calculateMD5(buffer: ArrayBuffer): string {
  // Convert ArrayBuffer to 32-bit words
  const words = new Uint32Array(buffer.byteLength + 8 >> 2);
  const view = new DataView(buffer);
  for (let i = 0; i < buffer.byteLength; i++) {
    words[i >> 2] |= view.getUint8(i) << ((i % 4) * 8);
  }
  words[buffer.byteLength >> 2] |= 0x80 << ((buffer.byteLength % 4) * 8);
  words[words.length - 2] = buffer.byteLength * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const H = (x: number, y: number, z: number) => x ^ y ^ z;
  const I = (x: number, y: number, z: number) => y ^ (x | ~z);

  const rot = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  const FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = (a + F(b, c, d) + x + ac) | 0;
    return (rot(a, s) + b) | 0;
  };
  const GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = (a + G(b, c, d) + x + ac) | 0;
    return (rot(a, s) + b) | 0;
  };
  const HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = (a + H(b, c, d) + x + ac) | 0;
    return (rot(a, s) + b) | 0;
  };
  const II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
    a = (a + I(b, c, d) + x + ac) | 0;
    return (rot(a, s) + b) | 0;
  };

  for (let j = 0; j < words.length; j += 16) {
    const aa = a, bb = b, cc = c, dd = d;

    // Round 1
    a = FF(a, b, c, d, words[j + 0], S11, -680876936);
    d = FF(d, a, b, c, words[j + 1], S12, -389564586);
    c = FF(c, d, a, b, words[j + 2], S13,  606105819);
    b = FF(b, c, d, a, words[j + 3], S14, -1044525330);
    a = FF(a, b, c, d, words[j + 4], S11, -176418897);
    d = FF(d, a, b, c, words[j + 5], S12,  1200080426);
    c = FF(c, d, a, b, words[j + 6], S13, -1473231341);
    b = FF(b, c, d, a, words[j + 7], S14, -45705983);
    a = FF(a, b, c, d, words[j + 8], S11,  1770035416);
    d = FF(d, a, b, c, words[j + 9], S12, -1958414417);
    c = FF(c, d, a, b, words[j + 10], S13, -42063);
    b = FF(b, c, d, a, words[j + 11], S14, -1990404162);
    a = FF(a, b, c, d, words[j + 12], S11,  1804603682);
    d = FF(d, a, b, c, words[j + 13], S12, -40341101);
    c = FF(c, d, a, b, words[j + 14], S13, -1502002290);
    b = FF(b, c, d, a, words[j + 15], S14,  1236535329);

    // Round 2
    a = GG(a, b, c, d, words[j + 1], S21, -165796510);
    d = GG(d, a, b, c, words[j + 6], S22, -1069501632);
    c = GG(c, d, a, b, words[j + 11], S23,  643717713);
    b = GG(b, c, d, a, words[j + 0], S24, -373897302);
    a = GG(a, b, c, d, words[j + 5], S21, -701558691);
    d = GG(d, a, b, c, words[j + 10], S22,  38016083);
    c = GG(c, d, a, b, words[j + 15], S23, -660478335);
    b = GG(b, c, d, a, words[j + 4], S24, -405537848);
    a = GG(a, b, c, d, words[j + 9], S21,  568446438);
    d = GG(d, a, b, c, words[j + 14], S22, -1019803690);
    c = GG(c, d, a, b, words[j + 3], S23, -187363961);
    b = GG(b, c, d, a, words[j + 8], S24,  1163531501);
    a = GG(a, b, c, d, words[j + 13], S21, -1444681467);
    d = GG(d, a, b, c, words[j + 2], S22, -51403784);
    c = GG(c, d, a, b, words[j + 7], S23,  1735328473);
    b = GG(b, c, d, a, words[j + 12], S24, -1926607734);

    // Round 3
    a = HH(a, b, c, d, words[j + 5], S31, -378558);
    d = HH(d, a, b, c, words[j + 8], S32, -2022574463);
    c = HH(c, d, a, b, words[j + 11], S33,  1839030562);
    b = HH(b, c, d, a, words[j + 14], S34, -35309556);
    a = HH(a, b, c, d, words[j + 1], S31, -1530992060);
    d = HH(d, a, b, c, words[j + 4], S32,  1272893353);
    c = HH(c, d, a, b, words[j + 7], S33, -155497632);
    b = HH(b, c, d, a, words[j + 10], S34, -1094730640);
    a = HH(a, b, c, d, words[j + 13], S31,  2448471);
    d = HH(d, a, b, c, words[j + 0], S32, -225010);
    c = HH(c, d, a, b, words[j + 3], S33, -1861084689);
    b = HH(b, c, d, a, words[j + 6], S34,  2000421703);
    a = HH(a, b, c, d, words[j + 9], S31, -22654302);
    d = HH(d, a, b, c, words[j + 12], S32, -1349374187);
    c = HH(c, d, a, b, words[j + 15], S33,  368270030);
    b = HH(b, c, d, a, words[j + 2], S34, -361401604);

    // Round 4
    a = II(a, b, c, d, words[j + 0], S41, -217734784);
    d = II(d, a, b, c, words[j + 7], S42,  1800603682);
    c = II(c, d, a, b, words[j + 14], S43, -40207157);
    b = II(b, c, d, a, words[j + 5], S44, -1930301635);
    a = II(a, b, c, d, words[j + 12], S41,  91402224);
    d = II(d, a, b, c, words[j + 3], S42, -165339024);
    c = II(c, d, a, b, words[j + 10], S43, -1881740289);
    b = II(b, c, d, a, words[j + 1], S44,  123565327);
    a = II(a, b, c, d, words[j + 8], S41, -165501535);
    d = II(d, a, b, c, words[j + 15], S42, -105450244);
    c = II(c, d, a, b, words[j + 6], S43,  640034456);
    b = II(b, c, d, a, words[j + 13], S44, -37533300);
    a = II(a, b, c, d, words[j + 4], S41, -701520691);
    d = II(d, a, b, c, words[j + 11], S42,  38003702);
    c = II(c, d, a, b, words[j + 2], S43, -660478337);
    b = II(b, c, d, a, words[j + 9], S44, -405537848);

    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }

  // Convert state words to hex representation
  const hex = [a, b, c, d].map((val) => {
    const u32 = new Uint32Array([val])[0];
    const bytes = [
      u32 & 0xff,
      (u32 >> 8) & 0xff,
      (u32 >> 16) & 0xff,
      (u32 >> 24) & 0xff,
    ];
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }).join("");

  // Convert hex digest to a Base64 string
  const rawBytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  const binaryString = String.fromCharCode(...rawBytes);
  return btoa(binaryString);
}
