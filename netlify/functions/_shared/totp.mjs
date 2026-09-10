// TOTP (RFC 6238) für die Zwei-Faktor-Authentifizierung — kompatibel mit
// Google Authenticator, Authy, 1Password etc. Reine node:crypto-Implementierung,
// keine zusätzliche Abhängigkeit nötig.
import { randomBytes, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20)); // 160-bit, der übliche TOTP-Secret-Umfang
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

// windowSteps=1: akzeptiert den aktuellen 30-Sekunden-Schritt plus je einen
// davor/danach — übliche Toleranz für leichte Uhr-Abweichungen aufs Handy.
export function verifyTotp(secretBase32, token, windowSteps = 1) {
  if (!token || !/^\d{6}$/.test(token)) return false;
  const secretBuffer = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const tokenBuffer = Buffer.from(token);
  for (let errorWindow = -windowSteps; errorWindow <= windowSteps; errorWindow++) {
    const candidate = Buffer.from(hotp(secretBuffer, counter + errorWindow));
    if (timingSafeEqual(candidate, tokenBuffer)) return true;
  }
  return false;
}

export function buildOtpauthUrl(secretBase32, accountLabel, issuer) {
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?${params.toString()}`;
}

// Wiederherstellungscodes: falls das Handy verloren geht, kommt man sonst
// nie wieder ins Admin-Konto. Einmal anzeigen, gehasht speichern, bei
// Benutzung als verbraucht markieren (nicht löschen, bleibt nachvollziehbar).
export function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex');
    codes.push(raw.slice(0, 5) + '-' + raw.slice(5));
  }
  return codes;
}

export function hashBackupCode(code) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(code.toLowerCase(), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyBackupCode(code, salt, hash) {
  if (!code || !salt || !hash) return false;
  const attempt = scryptSync(String(code).toLowerCase(), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}
