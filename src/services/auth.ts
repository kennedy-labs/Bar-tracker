/**
 * Production Authentication & Cryptographic Security Pipeline
 * Zero mock data. Hardware-accelerated Web Crypto API.
 */

import { User, Role } from '../types';

export interface AuthSession {
  token: string;
  userId: string;
  businessId: string;
  role: Role;
  username: string;
  name: string;
  createdAt: string;
  expiresAt: string;
}

export interface LockoutInfo {
  isLocked: boolean;
  attemptsLeft: number;
  secondsRemaining: number;
}

const SESSION_STORAGE_KEY = 'bartracker_auth_session';
const FAILED_ATTEMPTS_PREFIX = 'bartracker_failed_attempts_';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class AuthService {
  /**
   * Generates a cryptographically strong random hex salt
   */
  public generateSalt(byteLength: number = 16): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a secure session token
   */
  public generateSessionToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Cryptographically hashes a password or PIN with salt using SHA-256
   */
  public async hashCredential(credential: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${credential}:${salt}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies an input against stored hash and salt
   */
  public async verifyCredential(
    input: string,
    storedHash?: string,
    salt?: string
  ): Promise<boolean> {
    if (!input || !storedHash || !salt) return false;
    const computedHash = await this.hashCredential(input, salt);
    // Timing-safe comparison simulation
    if (computedHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * Rate limiting and brute-force protection
   */
  public getLockoutStatus(identifier: string): LockoutInfo {
    try {
      const key = `${FAILED_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS, secondsRemaining: 0 };
      }
      const data: { count: number; lockedUntil?: number } = JSON.parse(raw);
      const now = Date.now();

      if (data.lockedUntil && data.lockedUntil > now) {
        const secondsRemaining = Math.ceil((data.lockedUntil - now) / 1000);
        return { isLocked: true, attemptsLeft: 0, secondsRemaining };
      }

      if (data.lockedUntil && data.lockedUntil <= now) {
        // Lockout expired, reset
        sessionStorage.removeItem(key);
        return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS, secondsRemaining: 0 };
      }

      const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - (data.count || 0));
      return { isLocked: false, attemptsLeft, secondsRemaining: 0 };
    } catch {
      return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS, secondsRemaining: 0 };
    }
  }

  public recordFailedAttempt(identifier: string): LockoutInfo {
    try {
      const key = `${FAILED_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
      const raw = sessionStorage.getItem(key);
      const data: { count: number; lockedUntil?: number } = raw ? JSON.parse(raw) : { count: 0 };
      data.count = (data.count || 0) + 1;

      if (data.count >= MAX_FAILED_ATTEMPTS) {
        data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        sessionStorage.setItem(key, JSON.stringify(data));
        return { isLocked: true, attemptsLeft: 0, secondsRemaining: 60 };
      }

      sessionStorage.setItem(key, JSON.stringify(data));
      return {
        isLocked: false,
        attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - data.count),
        secondsRemaining: 0,
      };
    } catch {
      return { isLocked: false, attemptsLeft: 0, secondsRemaining: 0 };
    }
  }

  public clearFailedAttempts(identifier: string): void {
    try {
      const key = `${FAILED_ATTEMPTS_PREFIX}${identifier.toLowerCase().trim()}`;
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  /**
   * Session Management: Create, Store, Validate, Terminate
   */
  public createSession(user: User): AuthSession {
    const now = Date.now();
    const session: AuthSession = {
      token: this.generateSessionToken(),
      userId: user.id,
      businessId: user.businessId || '',
      role: user.role,
      username: user.username,
      name: user.name,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.error('Failed to persist session:', err);
    }

    return session;
  }

  public getActiveSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (!session || !session.token || !session.expiresAt) {
        this.destroySession();
        return null;
      }
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        this.destroySession();
        return null;
      }
      return session;
    } catch {
      this.destroySession();
      return null;
    }
  }

  public destroySession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('bartracker_session_user');
    } catch (err) {
      console.error('Error destroying session:', err);
    }
  }

  /**
   * Strips all sensitive fields before state or storage reflection
   */
  public sanitizeUser(user: User): Partial<User> {
    return {
      id: user.id,
      businessId: user.businessId,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      isArchived: user.isArchived,
    };
  }
}

export const authService = new AuthService();
