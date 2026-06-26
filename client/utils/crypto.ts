import CryptoJS from 'crypto-js';

/**
 * 端到端加密工具
 * 使用 AES-256-CBC 加密消息内容
 * 密钥通过房间号 + 固定盐值派生（PBKDF2）
 */

const SALT = 'OfflineChat_Secret_Salt_2024';
const KEY_SIZE = 256;
const ITERATIONS = 10000;

/**
 * 从房间号派生加密密钥
 */
function deriveKey(roomCode: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(roomCode, SALT, {
    keySize: KEY_SIZE / 32,
    iterations: ITERATIONS,
  });
}

/**
 * 加密消息
 * @param plaintext 原始消息文本
 * @param roomCode 房间号（作为密钥派生依据）
 * @returns 加密后的字符串（IV: ciphertext 格式）
 */
export function encrypt(plaintext: string, roomCode: string): string {
  const key = deriveKey(roomCode);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // 格式: base64(iv) + ":" + base64(ciphertext)
  return iv.toString(CryptoJS.enc.Base64) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

/**
 * 解密消息
 * @param encryptedText 加密后的字符串
 * @param roomCode 房间号
 * @returns 解密后的原始文本，解密失败返回 null
 */
export function decrypt(encryptedText: string, roomCode: string): string | null {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    const iv = CryptoJS.enc.Base64.parse(parts[0]);
    const ciphertext = CryptoJS.enc.Base64.parse(parts[1]);
    const key = deriveKey(roomCode);
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

/**
 * 检查文本是否为加密格式（包含 ":" 分隔符且两部分都是有效 base64）
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
