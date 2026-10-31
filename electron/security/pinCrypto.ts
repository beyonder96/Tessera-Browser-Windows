import crypto from 'node:crypto';

export class PinCrypto {
  /**
   * Hashes a 4-digit PIN using scrypt with a unique random salt.
   * Format: `saltHex:hashHex`
   */
  static hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(pin.trim(), salt, 32);
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  /**
   * Verifies a candidate PIN against a stored scrypt hash.
   * Backward compatible with legacy btoa strings.
   */
  static verifyPin(candidatePin: string, storedHash: string): boolean {
    if (!storedHash) return false;

    // Backward compatibility with legacy base64 encoded PINs
    if (!storedHash.includes(':')) {
      try {
        const decoded = Buffer.from(storedHash, 'base64').toString('utf-8');
        return decoded === candidatePin.trim();
      } catch {
        return false;
      }
    }

    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) return false;

    try {
      const candidateKey = crypto.scryptSync(candidatePin.trim(), salt, 32).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(candidateKey), Buffer.from(expectedHash));
    } catch {
      return false;
    }
  }
}
