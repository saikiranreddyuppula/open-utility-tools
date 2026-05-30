'use client';

import { useCallback, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Algo = 'bcrypt' | 'sha1' | 'apr1';

/* ----------------------------- MD5 (for APR1) ----------------------------- */

function md5bytes(input: Uint8Array): Uint8Array {
  function rotl(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }
  const origLen = input.length;
  const bitLen = origLen * 8;
  // padded length: multiple of 64
  const padded = new Uint8Array((((origLen + 8) >> 6) + 1) * 64);
  padded.set(input);
  padded[origLen] = 0x80;
  // append length (little-endian, 64-bit; we only handle < 2^32 bits which is plenty)
  const lo = bitLen >>> 0;
  const hi = Math.floor(bitLen / 4294967296) >>> 0;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, lo, true);
  dv.setUint32(padded.length - 4, hi, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < padded.length; off += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(off + j * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const mg = M[g] ?? 0;
      const ki = K[i] ?? 0;
      const si = s[i] ?? 0;
      const sum = (F + A + ki + mg) >>> 0;
      F = sum;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, si)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return out;
}

const APR1_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function to64(v: number, n: number): string {
  let out = '';
  let val = v;
  for (let i = 0; i < n; i++) {
    out += APR1_ALPHABET[val & 0x3f] ?? '.';
    val = Math.floor(val / 64);
  }
  return out;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/** Apache APR1 MD5 crypt — produces $apr1$salt$hash. (Validated against openssl passwd -apr1.) */
function apr1(password: string, salt: string): string {
  const enc = new TextEncoder();
  const pw = enc.encode(password);
  const saltBytes = enc.encode(salt);
  const magic = enc.encode('$apr1$');

  // alt = MD5(pw + salt + pw)
  const alt = md5bytes(concat(pw, saltBytes, pw));

  // Build the primary digest: pw + magic + salt, then `pwLen` bytes of `alt`.
  const pieces: Uint8Array[] = [pw, magic, saltBytes];
  let pl = pw.length;
  while (pl > 0) {
    pieces.push(alt.subarray(0, Math.min(16, pl)));
    pl -= 16;
  }
  // For each bit of password length: append a NUL byte if set, else the first pw byte.
  for (let i = pw.length; i > 0; i >>= 1) {
    if (i & 1) {
      pieces.push(new Uint8Array([0]));
    } else {
      pieces.push(pw.subarray(0, 1));
    }
  }
  let cur = md5bytes(concat(...pieces));

  // 1000 iterations of the strengthening loop.
  for (let i = 0; i < 1000; i++) {
    const parts: Uint8Array[] = [];
    parts.push(i & 1 ? pw : cur);
    if (i % 3) parts.push(saltBytes);
    if (i % 7) parts.push(pw);
    parts.push(i & 1 ? cur : pw);
    cur = md5bytes(concat(...parts));
  }

  const f = cur;
  const b = (idx: number): number => f[idx] ?? 0;
  let result = '';
  result += to64((b(0) << 16) | (b(6) << 8) | b(12), 4);
  result += to64((b(1) << 16) | (b(7) << 8) | b(13), 4);
  result += to64((b(2) << 16) | (b(8) << 8) | b(14), 4);
  result += to64((b(3) << 16) | (b(9) << 8) | b(15), 4);
  result += to64((b(4) << 16) | (b(10) << 8) | b(5), 4);
  result += to64(b(11), 2);

  return `$apr1$${salt}$${result}`;
}

/* --------------------------------- SHA-1 --------------------------------- */

async function sha1Base64(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await wc.subtle.digest('SHA-1', data);
  const bytes = new Uint8Array(digest);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return `{SHA}${btoa(bin)}`;
}

/* --------------------------------- bcrypt -------------------------------- */
// Compact, self-contained bcrypt ($2y$) implementation (Blowfish / EksBlowfish).

const BCRYPT_B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function bcryptBase64Encode(data: Uint8Array, len: number): string {
  let off = 0;
  let out = '';
  while (off < len) {
    let c1 = (data[off++] ?? 0) & 0xff;
    out += BCRYPT_B64[(c1 >> 2) & 0x3f];
    c1 = (c1 & 0x03) << 4;
    if (off >= len) {
      out += BCRYPT_B64[c1 & 0x3f];
      break;
    }
    let c2 = (data[off++] ?? 0) & 0xff;
    c1 |= (c2 >> 4) & 0x0f;
    out += BCRYPT_B64[c1 & 0x3f];
    c1 = (c2 & 0x0f) << 2;
    if (off >= len) {
      out += BCRYPT_B64[c1 & 0x3f];
      break;
    }
    c2 = (data[off++] ?? 0) & 0xff;
    c1 |= (c2 >> 6) & 0x03;
    out += BCRYPT_B64[c1 & 0x3f];
    out += BCRYPT_B64[c2 & 0x3f];
  }
  return out;
}

// Blowfish P-array (18 words) and S-boxes (4*256 words) — the canonical
// initial values from the fractional hex digits of pi. Verified against the
// reference constants (P[0]=243f6a88, S0[0]=d1310ba6).
const BCRYPT_P_HEX =
  '243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89452821e638d01377be5466cf34e90c6cc0ac29b7c97c50dd3f84d5b5b54709179216d5d98979fb1b';
const BCRYPT_S_HEX =
  'd1310ba698dfb5ac2ffd72dbd01adfb7b8e1afed6a267e96ba7c9045f12c7f9924a19947b3916cf70801f2e2858efc16636920d871574e69a458fea3f4933d7e0d95748f728eb658718bcd5882154aee7b54a41dc25a59b59c30d5392af26013c5d1b023286085f0ca417918b8db38ef8e79dcb0603a180e6c9e0e8bb01e8a3ed71577c1bd314b2778af2fda55605c60e65525f3aa55ab945748986263e8144055ca396a2aab10b6b4cc5c341141e8cea15486af7c72e993b3ee1411636fbc2a2ba9c55d741831f6ce5c3e169b87931eafd6ba336c24cf5c7a325381289586773b8f48986b4bb9afc4bfe81b6628219361d809ccfb21a991487cac605dec8032ef845d5de98575b1dc262302eb651b8823893e81d396acc50f6d6ff383f442392e0b4482a484200469c8f04a9e1f9b5e21c66842f6e96c9a670c9c61abd388f06a51a0d2d8542f68960fa728ab5133a36eef0b6c137a3be4ba3bf0507efb2a98a1f1651d39af017666ca593e82430e888cee8619456f9fb47d84a5c33b8b5ebee06f75d885c12073401a449f56c16aa64ed3aa62363f77061bfedf72429b023d37d0d724d00a1248db0fead349f1c09b075372c980991b7b25d479d8f6e8def7e3fe501ab6794c3b976ce0bd04c006bac1a94fb6409f60c45e5c9ec2196a246368fb6faf3e6c53b51339b2eb3b52ec6f6dfc511f9b30952ccc814544af5ebd09bee3d004de334afd660f2807192e4bb3c0cba85745c8740fd20b5f39b9d3fbdb5579c0bd1a60320ad6a100c6402c7279679f25fefb1fa3cc8ea5e9f8db3222f83c7516dffd616b152f501ec8ad0552ab323db5fafd23876053317b483e00df829e5c57bbca6f8ca01a87562edf1769dbd542a8f6287effc3ac6732c68c4f5573695b27b0bbca58c8e1ffa35db8f011a010fa3d98fd2183b84afcb56c2dd1d35b9a53e479b6f84565d28e49bc4bfb9790e1ddf2daa4cb7e3362fb1341cee4c6e8ef20cada36774c01d07e9efe2bf11fb495dbda4dae909198eaad8e716b93d5a0d08ed1d0afc725e08e3c5b2f8e7594b78ff6e2fbf2122b648888b812900df01c4fad5ea0688fc31cd1cff191b3a8c1ad2f2f2218be0e1777ea752dfe8b021fa1e5a0cc0fb56f74e818acf3d6ce89e299b4a84fe0fd13e0b77cc43b81d2ada8d9165fa2668095770593cc7314211a1477e6ad206577b5fa86c75442f5fb9d35cfebcdaf0c7b3e89a0d6411bd3ae1e7e4900250e2d2071b35e226800bb57b8e0af2464369bf009b91e5563911d59dfa6aa78c14389d95a537f207d5ba202e5b9c5832603766295cfa911c819684e734a41b3472dca7b14a94a1b5100529a532915d60f573fbc9bc6e42b60a47681e6740008ba6fb5571be91ff296ec6b2a0dd915b6636521e7b9f9b6ff34052ec585566453b02d5da99f8fa108ba47996e85076a4b7a70e9b5b32944db75092ec4192623ad6ea6b049a7df7d9cee60b88fedb266ecaa8c71699a17ff5664526cc2b19ee1193602a575094c29a0591340e4183a3e3f54989a5b429d656b8fe4d699f73fd6a1d29c07efe830f54d2d38e6f0255dc14cdd20868470eb266382e9c6021ecc5e09686b3f3ebaefc93c9718146b6a70a1687f358452a0e286b79c5305aa5007373e07841c7fdeae5c8e7d44ec5716f2b8b03ada37f0500c0df01c1f040200b3ffae0cf51a3cb574b225837a58dc0921bdd19113f97ca92ff69432477322f547013ae5e58137c2dadcc8b576349af3dda7a94461460fd0030eecc8c73ea4751e41e238cd993bea0e2f3280bba1183eb3314e548b384f6db9086f420d03f60a04bf2cb8129024977c795679b072bcaf89afde9a771fd9930810b38bae12dccf3f2e5512721f2e6b7124501adde69f84cd877a5847187408da17bc9f9abce94b7d8cec7aec3adb851dfa63094366c464c3d2ef1c18473215d908dd433b3724c2ba1612a14d432a65c45150940002133ae4dd71dff89e10314e5581ac77d65f11199b043556f1d7a3c76b3c11183b5924a509f28fe6ed97f1fbfa9ebabf2c1e153c6e86e34570eae96fb1860e5e0a5a3e2ab3771fe71c4e3d06fa2965dcb999e71d0f803e89d65266c8252e4cc9789c10b36ac6150eba94e2ea78a5fc3c531e0a2df4f2f74ea7361d2b3d1939260f19c279605223a708f71312b6ebadfe6eeac31f66e3bc4595a67bc883b17f37d1018cff28c332ddefbe6c5aa56558218568ab9802eecea50fdb2f953b2aef7dad5b6e2f841521b62829076170ecdd4775619f151013cca830eb61bd960334fe1eaa0363cfb5735c904c70a239d59e9e0bcbaade14eecc86bc60622ca79cab5cabb2f3846e648b1eaf19bdf0caa02369b9655abb5040685a323c2ab4b3319ee9d5c021b8f79b540b19875fa09995f7997e623d7da8f837889a97e32d7711ed935f166812810e358829c7e61fd696dedfa17858ba9957f584a51b2272639b83c3ff1ac24696cdb30aeb532e30548fd948e46dbc312858ebf2ef34c6ffeafe28ed61ee7c3c735d4a14d9e864b7e342105d14203e13e045eee2b6a3aaabeadb6c4f15facb4fd0c742f442ef6abbb5654f3b1d41cd2105d81e799e86854dc7e44b476a3d816250cf62a1f25b8d2646fc8883a0c1c7b6a37f1524c369cb749247848a0b5692b285095bbf00ad19489d1462b17423820e0058428d2a0c55f5ea1dadf43e233f70613372f0928d937e41d65fecf16c223bdb7cde3759cbee74604085f2a7ce77326ea607808419f8509ee8efd85561d99735a969a7aac50c06c25a04abfc800bcadc9e447a2ec3453484fdd567050e1e9ec9db73dbd3105588cd675fda79e3674340c5c43465713e38d83d28f89ef16dff20153e21e78fb03d4ae6e39f2bdb83adf7e93d5a68948140f7f64c261c94692934411520f77602d4f7bcf46b2ed4a20068d40824713320f46a43b7d4b7500061af1e39f62e9724454614214f74bf8b88404d95fc1d96b591af70f4ddd366a02f45bfbc09ec03bd97857fac6dd031cb850496eb27b355fd3941da2547e6abca0a9a28507825530429f40a2c86dae9b66dfb68dc1462d7486900680ec0a427a18dee4f3ffea2e887ad8cb58ce0067af4d6b6aace1e7cd3375fecce78a399406b2a4220fe9e35d9f385b9ee39d7ab3b124e8b1dc9faf74b6d185626a36631eae397b23a6efa74dd5b43326841e7f7ca7820fbfb0af54ed8feb397454056acba48952755533a3a20838d87fe6ba9b7d096954b55a867bca1159a58cca9296399e1db33a62a4a563f3125f95ef47e1c9029317cfdf8e80204272f7080bb155c05282ce395c11548e4c66d2248c1133fc70f86dc07f9c9ee41041f0f404779a45d886e17325f51ebd59bc0d1f2bcc18f41113564257b7834602a9c60dff8e8a31f636c1b0e12b4c202e1329eaf664fd1cad181156b2395e0333e92e13b240b62eebeb92285b2a20ee6ba0d99de720c8c2da2f728d012784595b794fd647d0862e7ccf5f05449a36f877d48fac39dfd27f33e8d1e0a476341992eff743a6f6eabf4f8fd37a812dc60a1ebddf8991be14cdb6e6b0dc67b55106d672c372765d43bdcd0e804f1290dc7cc00ffa3b5390f92690fed0b667b9ffbcedb7d9ca091cf0bd9155ea3bb132f88515bad247b9479bf763bd6eb37392eb3cc1159798026e297f42e312d6842ada7c66a2b3b12754ccc782ef11c6a124237b79251e706a1bbe64bfb63501a6b101811caedfa3d25bdd8e2e1c3c9444216590a121386d90cec6ed5abea2a64af674eda86a85fbebfe98864e4c3fe9dbc8057f0f7c08660787bf86003604dd1fd8346f6381fb07745ae04d736fccc83426b33f01eab71b08041873c005e5f77a057bebde8ae2455464299bf582e614e58f48ff2ddfda2f474ef388789bdc25366f9c3c8b38e74b475f25546fcd9b97aeb26618b1ddf84846a0e79915f95e2466e598e20b457708cd55591c902de4cb90bace1bb8205d011a862487574a99eb77f19b6e0a9dc09662d09a1c4324633e85a1f0209f0be8c4a99a0251d6efe101ab93d1d0ba5a4dfa186f20f2868f169dcb7da83573906fea1e2ce9b4fcd7f5250115e01a70683faa002b5c40de6d0279af88c27773f8641c3604c0661a806b5f0177a28c0f586e0006058aa30dc7d6211e69ed72338ea6353c2dd94c2c21634bbcbee5690bcb6deebfc7da1ce591d766f05e4094b7c018839720a3d7c927c2486e3725f724d9db91ac15bb4d39eb8fced54557808fca5b5d83d7cd34dad0fc41e50ef5eb161e6f8a28514d96c51133c6fd5c7e756e14ec4362abfceddc6c837d79a323492638212670efa8e406000e03a39ce37d3faf5cfabc277375ac52d1b5cb0679e4fa33742d382274099bc9bbed5118e9dbf0f7315d62d1c7ec700c47bb78c1b6b21a19045b26eb1be6a366eb45748ab2fbc946e79c6a376d26549c2c8530ff8ee468dde7dd5730a1d4cd04dc62939bbdba9ba4650ac9526e8be5ee304a1fad5f06a2d519a63ef8ce29a86ee22c089c2b843242ef6a51e03aa9cf2d0a483c061ba9be96a4d8fe51550ba645bd62826a2f9a73a3ae14ba99586ef5562e9c72fefd3f752f7da3f046f6977fa0a5980e4a91587b086019b09e6ad3b3ee593e990fd5a9e34d7972cf0b7d9022b8b5196d5ac3a017da67dd1cf3ed67c7d2d281f9f25cfadf2b89b5ad6b4725a88f54ce029ac71e019a5e647b0acfded93fa9be8d3c48d283b57ccf8d5662979132e28785f0191ed756055f7960e44e3d35e8c15056dd488f46dba03a161250564f0bdc3eb9e153c9057a297271aeca93a072a1b3f6d9b1e6321f5f59c66fb26dcf3197533d928b155fdf5035634828aba3cbb28517711c20ad9f8abcc5167ccad925f4de817513830dc8e379d58629320f991ea7a90c2fb3e7bce5121ce64774fbe32a8b6e37ec3293d4648de53696413e680a2ae0810dd6db22469852dfd09072166b39a460a6445c0dd586cdecf1c20c8ae5bbef7dd1b588d40ccd2017f6bb4e3bbdda26a7e3a59ff453e350a44bcb4cdd572eacea8fa6484bb8d6612aebf3c6f47d29be463542f5d9eaec2771bf64e6370740e0d8de75b1357f8721671af537d5d4040cb084eb4e2cc34d2466a0115af84e1b0042895983a1d06b89fb4ce6ea0486f3f3b823520ab82011a1d4b277227f8611560b1e7933fdcbb3a792b344525bda08839e151ce794b2f32c9b7a01fbac9e01cc87ebcc7d1f6cf0111c3a1e8aac71a908749d44fbd9ad0dadecbd50ada380339c32ac69136678df9317ce0b12b4ff79e59b743f5bb3af2d519ff27d9459cbf97222c15e6fc2a0f91fc719b941525fae59361ceb69cebc2a8645912baa8d1b6c1075ee3056a0c10d25065cb03a442e0ec6e0e1698db3b4c98a0be3278e9649f1f9532e0d392dfd3a0342b8971f21e1b0a74414ba3348cc5be7120c37632d8df359f8d9b992f2ee60b6f470fe3f11de54cda541edad891ce6279cfcd3e7e6f1618b166fd2c1d05848fd2c5f6fb2299f523f357a632762393a8353156cccd02acf081625a75ebb56e16369788d273ccde96629281b949d04c50901b71c65614e6c6c7bd327a140a45e1d006c3f27b9ac9aa53fd62a80f00bb25bfe235bdd2f671126905b2040222b6cbcf7ccd769c2b53113ec01640e3d338abbd602547adf0ba38209cf746ce7677afa1c52075606085cbfe4e8ae88dd87aaaf9b04cf9aa7e1948c25c02fb8a8c01c36ae4d6ebe1f990d4f869a65cdea03f09252dc208e69fb74e6132ce77e25b578fdfe33ac372e6';

function hexToUint32Array(hex: string): Uint32Array {
  const n = Math.floor(hex.length / 8);
  const arr = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  }
  return arr;
}

class Blowfish {
  P: Uint32Array;
  S: Uint32Array; // 4 * 256 = 1024 entries
  constructor() {
    this.P = hexToUint32Array(BCRYPT_P_HEX);
    this.S = hexToUint32Array(BCRYPT_S_HEX);
  }
  private f(x: number): number {
    const a = (x >>> 24) & 0xff;
    const b = (x >>> 16) & 0xff;
    const c = (x >>> 8) & 0xff;
    const d = x & 0xff;
    const S = this.S;
    let y = ((S[a] ?? 0) + (S[256 + b] ?? 0)) >>> 0;
    y = (y ^ (S[512 + c] ?? 0)) >>> 0;
    y = (y + (S[768 + d] ?? 0)) >>> 0;
    return y >>> 0;
  }
  encryptPair(l0: number, r0: number): [number, number] {
    let l = l0 >>> 0;
    let r = r0 >>> 0;
    const P = this.P;
    for (let i = 0; i < 16; i++) {
      l = (l ^ (P[i] ?? 0)) >>> 0;
      r = (r ^ this.f(l)) >>> 0;
      const t = l;
      l = r;
      r = t;
    }
    const t = l;
    l = r;
    r = t;
    r = (r ^ (P[16] ?? 0)) >>> 0;
    l = (l ^ (P[17] ?? 0)) >>> 0;
    return [l >>> 0, r >>> 0];
  }
}

/** Stream of 32-bit words from key bytes, cyclically. */
function streamWord(data: Uint8Array, offsetObj: { o: number }): number {
  let word = 0;
  for (let i = 0; i < 4; i++) {
    word = ((word << 8) | (data[offsetObj.o] ?? 0)) >>> 0;
    offsetObj.o = (offsetObj.o + 1) % data.length;
  }
  return word >>> 0;
}

function expandKey(bf: Blowfish, data: Uint8Array, key: Uint8Array): void {
  const dOff = { o: 0 };
  for (let i = 0; i < 18; i++) {
    bf.P[i] = ((bf.P[i] ?? 0) ^ streamWord(key, dOff)) >>> 0;
  }
  const sOff = { o: 0 };
  let l = 0;
  let r = 0;
  for (let i = 0; i < 18; i += 2) {
    l = (l ^ streamWord(data, sOff)) >>> 0;
    r = (r ^ streamWord(data, sOff)) >>> 0;
    const [nl, nr] = bf.encryptPair(l, r);
    l = nl;
    r = nr;
    bf.P[i] = l;
    bf.P[i + 1] = r;
  }
  for (let i = 0; i < 1024; i += 2) {
    l = (l ^ streamWord(data, sOff)) >>> 0;
    r = (r ^ streamWord(data, sOff)) >>> 0;
    const [nl, nr] = bf.encryptPair(l, r);
    l = nl;
    r = nr;
    bf.S[i] = l;
    bf.S[i + 1] = r;
  }
}

function bcryptRaw(password: Uint8Array, salt16: Uint8Array, cost: number): Uint8Array {
  // key = password + null terminator
  const key = new Uint8Array(password.length + 1);
  key.set(password);
  key[password.length] = 0;

  const zero16 = new Uint8Array(16);
  const bf = new Blowfish();
  // Initial expensive setup: XOR P with the key, encrypt the salt block.
  expandKey(bf, salt16, key);
  const rounds = 1 << cost;
  // Each round alternates: XOR P with key (encrypt zero block), then XOR P with salt.
  for (let i = 0; i < rounds; i++) {
    expandKey(bf, zero16, key);
    expandKey(bf, zero16, salt16);
  }

  // "OrpheanBeholderScryDoubt" as 6 words.
  const ctextWords = [0x4f727068, 0x65616e42, 0x65686f6c, 0x64657253, 0x63727944, 0x6f756274];
  const cdata = new Uint32Array(ctextWords);
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 6; j += 2) {
      const [l, r] = bf.encryptPair(cdata[j] ?? 0, cdata[j + 1] ?? 0);
      cdata[j] = l;
      cdata[j + 1] = r;
    }
  }
  const out = new Uint8Array(24);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < 6; i++) dv.setUint32(i * 4, cdata[i] ?? 0, false);
  return out;
}

function bcryptHash(password: string, salt16: Uint8Array, cost: number): string {
  const pwBytes = new TextEncoder().encode(password);
  // bcrypt truncates at 72 bytes.
  const pw = pwBytes.subarray(0, 72);
  const raw = bcryptRaw(pw, salt16, cost);
  // bcrypt outputs 23 bytes of the 24-byte ctext.
  const saltStr = bcryptBase64Encode(salt16, 16);
  const hashStr = bcryptBase64Encode(raw, 23);
  const costStr = cost.toString().padStart(2, '0');
  return `$2y$${costStr}$${saltStr}${hashStr}`;
}

/* ------------------------------ component -------------------------------- */

function randomSaltString(len: number): string {
  const bytes = new Uint8Array(len);
  wc.getRandomValues(bytes);
  return Array.from(bytes, (b) => APR1_ALPHABET[b % 64] ?? '.').join('');
}

function randomSalt16(): Uint8Array {
  const b = new Uint8Array(16);
  wc.getRandomValues(b);
  return b;
}

interface Entry {
  user: string;
  line: string;
}

async function hashOne(user: string, password: string, algo: Algo, cost: number): Promise<string> {
  if (algo === 'sha1') return `${user}:${await sha1Base64(password)}`;
  if (algo === 'apr1') return `${user}:${apr1(password, randomSaltString(8))}`;
  return `${user}:${bcryptHash(password, randomSalt16(), cost)}`;
}

export default function HtpasswdGeneratorTool() {
  const [user, setUser] = useState('admin');
  const [password, setPassword] = useState('correct horse battery staple');
  const [algo, setAlgo] = useState<Algo>('bcrypt');
  const [cost, setCost] = useState(10);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addEntry = useCallback(async () => {
    setError(null);
    const u = user.trim();
    if (!u) {
      setError('Username is required.');
      return;
    }
    if (u.includes(':')) {
      setError('Username cannot contain a colon.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    setBusy(true);
    try {
      const line = await hashOne(u, password, algo, cost);
      setEntries((prev) => {
        // Replace an existing entry for the same user.
        const without = prev.filter((e) => e.user !== u);
        return [...without, { user: u, line }];
      });
    } catch {
      setError('Hashing failed in this browser.');
    } finally {
      setBusy(false);
    }
  }, [user, password, algo, cost]);

  const fileText = entries.map((e) => e.line).join('\n') + (entries.length ? '\n' : '');

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Username">
          <Input value={user} onChange={(e) => setUser(e.target.value)} className="w-40 font-mono" />
        </Field>
        <Field label="Password" className="min-w-[200px] flex-1">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Algorithm">
          <Select value={algo} onValueChange={(v) => setAlgo(v as Algo)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bcrypt">bcrypt ($2y$)</SelectItem>
              <SelectItem value="apr1">MD5 / APR1 ($apr1$)</SelectItem>
              <SelectItem value="sha1">SHA-1 ({'{'}SHA{'}'})</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {algo === 'bcrypt' && (
          <Field label={`bcrypt cost: ${cost}`} className="min-w-[180px]">
            <Slider
              value={[cost]}
              min={4}
              max={14}
              step={1}
              onValueChange={(v) => setCost(v[0] ?? 10)}
            />
          </Field>
        )}
        <div className="flex items-end">
          <Button size="sm" onClick={addEntry} disabled={busy}>
            <Plus className="size-3.5" /> {busy ? 'Hashing…' : 'Add / update user'}
          </Button>
        </div>
      </OptionsBar>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title=".htpasswd">
          <CopyButton value={() => fileText} label="Copy all" disabled={!entries.length} />
          <DownloadButton data={() => fileText} filename=".htpasswd" disabled={!entries.length} />
        </PanelHeader>
        <div className="max-h-[400px] divide-y overflow-auto">
          {entries.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No entries yet. Fill the form and click “Add / update user”.
            </p>
          )}
          {entries.map((e) => (
            <div key={e.user} className="flex items-center gap-3 px-3 py-1.5">
              <code className="min-w-0 flex-1 truncate font-mono text-2xs">{e.line}</code>
              <CopyButton value={e.line} size="icon-sm" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove"
                onClick={() => setEntries((prev) => prev.filter((x) => x.user !== e.user))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `${entries.length} user${entries.length === 1 ? '' : 's'}`,
            `algo=${algo}`,
            algo === 'bcrypt' && `cost=${cost}`,
          ]}
        />
      </Panel>
    </div>
  );
}
