/**
 * TokenGuard SDK v2 — TypeScript Definitions
 */

export interface TokenGuardOptions {
  /** Your project ID from the dashboard (required) */
  projectId: string;

  /** TokenGuard API base URL. Default: https://api.tokenguard.io */
  api?: string;

  /**
   * Protection mode.
   * - 'runtime': full protection with heartbeat (default)
   * - 'passive': validate once, no heartbeat
   */
  mode?: 'runtime' | 'passive';

  /** Enforce strict domain matching. Default: true */
  strictDomain?: boolean;

  /** Custom title shown in the block overlay */
  blockTitle?: string;

  /** Custom background color for the block overlay */
  blockBackground?: string;
}

export interface AuthGrantedEvent {
  projectId: string;
  expiresIn: number;
}

export interface AuthBlockedEvent {
  reason: string;
}

export interface SessionLostEvent {
  reason: string;
}

export interface TokenRefreshEvent {
  expiresIn: number;
}

export interface HeartbeatErrorEvent {
  error: Error;
}

export interface InitErrorEvent {
  error: Error;
}

export type TokenGuardEventMap = {
  'auth:granted':     AuthGrantedEvent;
  'auth:blocked':     AuthBlockedEvent;
  'session:lost':     SessionLostEvent;
  'token:refresh':    TokenRefreshEvent;
  'heartbeat:error':  HeartbeatErrorEvent;
  'init:start':       { projectId: string };
  'init:error':       InitErrorEvent;
};

export type UnsubscribeFn = () => void;

export interface TokenGuardSDK {
  /** SDK version string */
  readonly version: string;

  /**
   * Initialize TokenGuard runtime protection.
   *
   * @example
   * await TokenGuard.init({ projectId: 'proj_xxx' });
   *
   * @example
   * // With event listeners
   * TokenGuard.on('auth:granted', ({ expiresIn }) => {
   *   console.log('Authorized for', expiresIn, 'seconds');
   * });
   * await TokenGuard.init({ projectId: 'proj_xxx' });
   */
  init(options: TokenGuardOptions): Promise<void>;

  /** Returns true if the current session is authorized */
  isAuthorized(): boolean;

  /** Returns the current session ID (client-generated) */
  getSessionId(): string | null;

  /**
   * Subscribe to a TokenGuard event.
   * Returns an unsubscribe function.
   *
   * @example
   * const off = TokenGuard.on('session:lost', ({ reason }) => {
   *   console.warn('Session lost:', reason);
   * });
   * // later:
   * off(); // unsubscribe
   */
  on<K extends keyof TokenGuardEventMap>(
    event: K,
    handler: (data: TokenGuardEventMap[K]) => void
  ): UnsubscribeFn;

  /** Unsubscribe a specific handler from an event */
  off<K extends keyof TokenGuardEventMap>(
    event: K,
    handler: (data: TokenGuardEventMap[K]) => void
  ): void;

  /**
   * Tear down the SDK — stops heartbeat, removes overlays.
   * Call before re-initializing or unmounting.
   */
  destroy(): void;
}

declare const TokenGuard: TokenGuardSDK;
export default TokenGuard;

// Global augmentation for UMD/CDN usage
declare global {
  interface Window {
    TokenGuard: TokenGuardSDK;
  }
}
