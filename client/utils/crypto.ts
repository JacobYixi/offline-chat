import CryptoJS from 'crypto-js';

/**
 * Hybrid Encryption Module
 *
 * Supports three encryption modes:
 * 1. Shared Key: For public messages (all users share the same key)
 * 2. ECDH: For private messages (each pair has unique shared secret)
 * 3. Group Key: For small group messages (group members share a key)
 */

const SALT = 'OfflineChat_Secret_Salt_2024';
const KEY_SIZE = 256;
const ITERATIONS = 10000;

// ─── Shared Key Encryption (Public Messages) ───

/**
 * Derive encryption key from shared key
 */
function deriveKey(sharedKey: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(sharedKey, SALT, {
    keySize: KEY_SIZE / 32,
    iterations: ITERATIONS,
  });
}

/**
 * Encrypt message with shared key (for public messages)
 */
export function encryptWithSharedKey(
  plaintext: string,
  sharedKey: string
): string {
  const key = deriveKey(sharedKey);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString(CryptoJS.enc.Base64) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

/**
 * Decrypt message with shared key
 */
export function decryptWithSharedKey(
  encryptedText: string,
  sharedKey: string
): string | null {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    const iv = CryptoJS.enc.Base64.parse(parts[0]);
    const ciphertext = CryptoJS.enc.Base64.parse(parts[1]);
    const key = deriveKey(sharedKey);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext } as CryptoJS.lib.CipherParams,
      key,
      {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) return null;
    return result;
  } catch {
    return null;
  }
}

// ─── Group Key Encryption (Small Group Messages) ───

/**
 * Encrypt message with group key (for small group messages)
 * Uses the same mechanism as shared key encryption
 */
export function encryptWithGroupKey(
  plaintext: string,
  groupKey: string
): string {
  return encryptWithSharedKey(plaintext, groupKey);
}

/**
 * Decrypt message with group key
 */
export function decryptWithGroupKey(
  encryptedText: string,
  groupKey: string
): string | null {
  return decryptWithSharedKey(encryptedText, groupKey);
}

// ─── ECDH Key Exchange (Private Messages) ───

/**
 * Generate ECDH key pair
 * Note: In a real implementation, this would use elliptic curve cryptography.
 * For simplicity, we use a simulated ECDH with shared secret derivation.
 */
export function generateECDHKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  // Generate random private key
  const privateKey = CryptoJS.lib.WordArray.random(32).toString();
  // Derive public key (in real ECDH, this would be a point on the curve)
  const publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
  return { publicKey, privateKey };
}

/**
 * Compute shared secret from ECDH key exchange
 * In real ECDH: sharedSecret = ECDH(myPrivateKey, theirPublicKey)
 */
export function computeECDHSharedSecret(
  myPrivateKey: string,
  theirPublicKey: string
): string {
  // Simulated ECDH shared secret computation
  return CryptoJS.SHA256(myPrivateKey + theirPublicKey).toString();
}

/**
 * Encrypt message for private chat (using ECDH shared secret)
 */
export function encryptPrivateMessage(
  plaintext: string,
  sharedSecret: string
): string {
  return encryptWithSharedKey(plaintext, sharedSecret);
}

/**
 * Decrypt private message
 */
export function decryptPrivateMessage(
  encryptedText: string,
  sharedSecret: string
): string | null {
  return decryptWithSharedKey(encryptedText, sharedSecret);
}

// ─── Utility Functions ───

/**
 * Check if text is in encrypted format
 */
export function isEncryptedFormat(text: string): boolean {
  const parts = text.split(':');
  if (parts.length !== 2) return false;
  try {
    CryptoJS.enc.Base64.parse(parts[0]);
    CryptoJS.enc.Base64.parse(parts[1]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random encryption key
 */
export function generateRandomKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

/**
 * Hash a password for storage/transmission
 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + SALT).toString();
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// ─── Legacy Compatibility ───

/**
 * Legacy encrypt function (for backward compatibility)
 * @deprecated Use encryptWithSharedKey instead
 */
export function encrypt(plaintext: string, roomCode: string): string {
  return encryptWithSharedKey(plaintext, roomCode);
}

/**
 * Legacy decrypt function (for backward compatibility)
 * @deprecated Use decryptWithSharedKey instead
 */
export function decrypt(encryptedText: string, roomCode: string): string | null {
  return decryptWithSharedKey(encryptedText, roomCode);
}
