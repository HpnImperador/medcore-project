import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptState {
  failed_count: number;
  window_started_at_ms: number;
  locked_until_ms: number | null;
  updated_at_ms: number;
}

@Injectable()
export class LoginAttemptService {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(private readonly configService: ConfigService) {}

  checkLock(key: string): { locked: boolean; retry_after_seconds: number } {
    this.pruneOldEntries();

    const state = this.attempts.get(key);
    if (!state || !state.locked_until_ms) {
      return { locked: false, retry_after_seconds: 0 };
    }

    const now = Date.now();
    if (state.locked_until_ms <= now) {
      state.locked_until_ms = null;
      state.failed_count = 0;
      state.window_started_at_ms = now;
      state.updated_at_ms = now;
      this.attempts.set(key, state);
      return { locked: false, retry_after_seconds: 0 };
    }

    const retryAfterSeconds = Math.ceil((state.locked_until_ms - now) / 1000);
    return {
      locked: true,
      retry_after_seconds: retryAfterSeconds,
    };
  }

  registerFailure(key: string): {
    locked: boolean;
    retry_after_seconds: number;
  } {
    this.pruneOldEntries();

    const now = Date.now();
    const state = this.attempts.get(key) ?? {
      failed_count: 0,
      window_started_at_ms: now,
      locked_until_ms: null,
      updated_at_ms: now,
    };

    const windowMs = this.getAttemptWindowMs();
    if (now - state.window_started_at_ms > windowMs) {
      state.failed_count = 0;
      state.window_started_at_ms = now;
      state.locked_until_ms = null;
    }

    state.failed_count += 1;
    state.updated_at_ms = now;

    const maxFailures = this.getMaxFailedAttempts();
    if (state.failed_count >= maxFailures) {
      const lockMs = this.getLockDurationMinutes() * 60 * 1000;
      state.locked_until_ms = now + lockMs;
      state.failed_count = 0;
      state.window_started_at_ms = now;
    }

    this.attempts.set(key, state);

    if (!state.locked_until_ms) {
      return { locked: false, retry_after_seconds: 0 };
    }

    return {
      locked: true,
      retry_after_seconds: Math.ceil((state.locked_until_ms - now) / 1000),
    };
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  private getMaxFailedAttempts(): number {
    const configured = this.configService.get<string>(
      'AUTH_MAX_FAILED_ATTEMPTS',
    );
    const parsed = Number.parseInt(configured ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 5;
    }
    return parsed;
  }

  private getAttemptWindowMs(): number {
    const configured = this.configService.get<string>(
      'AUTH_ATTEMPT_WINDOW_MINUTES',
    );
    const parsed = Number.parseInt(configured ?? '', 10);
    const minutes = Number.isNaN(parsed) || parsed <= 0 ? 15 : parsed;
    return minutes * 60 * 1000;
  }

  private getLockDurationMinutes(): number {
    const configured = this.configService.get<string>('AUTH_LOCK_MINUTES');
    const parsed = Number.parseInt(configured ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 15;
    }
    return parsed;
  }

  private pruneOldEntries(): void {
    const now = Date.now();
    const maxIdleMs = Math.max(this.getAttemptWindowMs(), 60 * 60 * 1000);

    for (const [key, value] of this.attempts.entries()) {
      const lockExpired =
        value.locked_until_ms === null || value.locked_until_ms <= now;
      const idleExpired = now - value.updated_at_ms > maxIdleMs;
      if (lockExpired && idleExpired) {
        this.attempts.delete(key);
      }
    }
  }
}
