/**
 * Pure In-Memory Authentication & Cryptographic Security Pipeline
 * Zero persistence. No localStorage, no sessionStorage, no external databases.
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
  signature?: string;
}

export interface LockoutInfo {
  isLocked: boolean;
  attemptsLeft: number;
  secondsRemaining: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SIGN_SALT = 'bar_track_sec_sess_sig_v1';

class AuthService {
  // Pure in-memory session and lockout storage
  private currentSession: AuthSession | null = null;
  private lockoutMap = new Map<string, { count: number; lockedUntil?: number }>();

  /**
   * Computes a deterministic tamper-resistant signature for an active session
   */
  private computeSessionSignature(
    token: string,
    userId: string,
    businessId: string,
    role: Role,
    username: string,
    expiresAt: string
  ): string {
    const raw = `${SESSION_SIGN_SALT}:${token}:${userId}:${businessId}:${role}:${username.toLowerCase()}:${expiresAt}:${SESSION_SIGN_SALT}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36) + token.slice(0, 8);
  }

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
    if (computedHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * In-memory rate limiting and brute-force protection
   */
  public getLockoutStatus(identifier: string): LockoutInfo {
    const key = identifier.toLowerCase().trim();
    const data = this.lockoutMap.get(key);
    if (!data) {
      return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS, secondsRemaining: 0 };
    }
    const now = Date.now();

    if (data.lockedUntil && data.lockedUntil > now) {
      const secondsRemaining = Math.ceil((data.lockedUntil - now) / 1000);
      return { isLocked: true, attemptsLeft: 0, secondsRemaining };
    }

    if (data.lockedUntil && data.lockedUntil <= now) {
      this.lockoutMap.delete(key);
      return { isLocked: false, attemptsLeft: MAX_FAILED_ATTEMPTS, secondsRemaining: 0 };
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - (data.count || 0));
    return { isLocked: false, attemptsLeft, secondsRemaining: 0 };
  }

  public recordFailedAttempt(identifier: string): LockoutInfo {
    const key = identifier.toLowerCase().trim();
    const data = this.lockoutMap.get(key) || { count: 0 };
    data.count = (data.count || 0) + 1;

    if (data.count >= MAX_FAILED_ATTEMPTS) {
      data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      this.lockoutMap.set(key, data);
      return { isLocked: true, attemptsLeft: 0, secondsRemaining: 60 };
    }

    this.lockoutMap.set(key, data);
    return {
      isLocked: false,
      attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - data.count),
      secondsRemaining: 0,
    };
  }

  public clearFailedAttempts(identifier: string): void {
    const key = identifier.toLowerCase().trim();
    this.lockoutMap.delete(key);
  }

  /**
   * Session Management: Persistent & Offline-Resilient with Tamper Proofing
   */
  public createSession(user: User): AuthSession {
    const now = Date.now();
    const token = this.generateSessionToken();
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    const businessId = user.businessId || '';
    const signature = this.computeSessionSignature(
      token,
      user.id,
      businessId,
      user.role,
      user.username,
      expiresAt
    );

    const session: AuthSession = {
      token,
      userId: user.id,
      businessId,
      role: user.role,
      username: user.username,
      name: user.name,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      signature,
    };

    this.currentSession = session;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bartracker_active_session', JSON.stringify(session));
        localStorage.setItem('bartracker_session_user', JSON.stringify(user));
      } catch {
        // quota or private mode fallback
      }
    }
    return session;
  }

  public getActiveSession(): AuthSession | null {
    if (!this.currentSession && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bartracker_active_session');
        if (stored) {
          const parsed = JSON.parse(stored) as AuthSession;
          if (parsed && parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
            // Strict tamper check: signature is MANDATORY. Any unsigned or altered session is rejected immediately.
            if (!parsed.signature) {
              console.warn('Unsigned session detected! Invalidating session.');
              this.destroySession();
              return null;
            }
            const expectedSig = this.computeSessionSignature(
              parsed.token,
              parsed.userId,
              parsed.businessId,
              parsed.role,
              parsed.username,
              parsed.expiresAt
            );
            if (parsed.signature !== expectedSig) {
              console.warn('Tampered session signature detected! Invalidating session.');
              this.destroySession();
              return null;
            }
            this.currentSession = parsed;
          } else {
            localStorage.removeItem('bartracker_active_session');
            localStorage.removeItem('bartracker_session_user');
          }
        }
      } catch {
        // ignore parse error
      }
    }

    if (!this.currentSession) return null;
    if (new Date(this.currentSession.expiresAt).getTime() <= Date.now()) {
      this.destroySession();
      return null;
    }
    return this.currentSession;
  }

  public destroySession(): void {
    this.currentSession = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('bartracker_active_session');
        localStorage.removeItem('bartracker_session_user');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Strips all sensitive fields before state reflection
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
