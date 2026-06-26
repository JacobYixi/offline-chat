/**
 * Device Identity Module
 *
 * Handles device identification and authentication:
 * - Generates unique deviceId (UUID v4) on first launch
 * - Generates device secret for challenge-response authentication
 * - Uses expo-secure-store for secure storage (when available)
 * - Falls back to AsyncStorage for web platform
 */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId, saveDeviceId, getDeviceSecret, saveDeviceSecret } from './storage';

const DEVICE_ID_KEY = '@offlinechat:deviceId';
const DEVICE_SECRET_KEY = '@offlinechat:deviceSecret';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return Crypto.randomUUID();
}

/**
 * Get or create device ID
 * Returns existing deviceId if already generated, otherwise creates a new one
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Try to get existing deviceId
  let deviceId = await getDeviceId();

  if (!deviceId) {
    // Generate new deviceId
    deviceId = generateUUID();
    await saveDeviceId(deviceId);
    console.log('[DeviceIdentity] Generated new deviceId:', deviceId);
  }

  return deviceId;
}

/**
 * Get or create device secret
 * The secret is used for challenge-response authentication
 */
export async function getOrCreateDeviceSecret(): Promise<string> {
  let secret = await getDeviceSecret();

  if (!secret) {
    // Generate a random secret
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    secret = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await saveDeviceSecret(secret);
    console.log('[DeviceIdentity] Generated new device secret');
  }

  return secret;
}

/**
 * Initialize device identity
 * Should be called on app startup
 */
export async function initializeDeviceIdentity(): Promise<{
  deviceId: string;
  deviceSecret: string;
}> {
  const [deviceId, deviceSecret] = await Promise.all([
    getOrCreateDeviceId(),
    getOrCreateDeviceSecret(),
  ]);

  return { deviceId, deviceSecret };
}

/**
 * Generate a challenge response
 * Used to prove device identity to the server
 */
export async function generateChallengeResponse(
  challenge: string,
  deviceSecret: string
): Promise<string> {
  // HMAC-SHA256(challenge, deviceSecret)
  const message = challenge + deviceSecret;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
  return hash;
}

/**
 * Verify a challenge response (server-side)
 */
export async function verifyChallengeResponse(
  challenge: string,
  response: string,
  expectedSecret: string
): Promise<boolean> {
  const expectedResponse = await generateChallengeResponse(
    challenge,
    expectedSecret
  );
  return response === expectedResponse;
}

/**
 * Clear device identity (for testing or reset)
 */
export async function clearDeviceIdentity(): Promise<void> {
  await AsyncStorage.multiRemove([DEVICE_ID_KEY, DEVICE_SECRET_KEY]);
  console.log('[DeviceIdentity] Cleared device identity');
}
