import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type RateLimitEntry = {
  hits: number[];
};

@Injectable()
export class OutboxAdminRateLimitGuard implements CanActivate {
  private readonly bucket = new Map<string, RateLimitEntry>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { userId?: string; sub?: string } | undefined;

    const keyUser = user?.userId ?? user?.sub ?? 'unknown-user';
    const ip = this.getClientIp(request);
    const key = `${keyUser}:${ip}`;

    const windowSeconds = this.getPositiveIntEnv(
      'OUTBOX_ADMIN_RATE_LIMIT_WINDOW_SECONDS',
      60,
    );
    const maxRequests = this.getPositiveIntEnv(
      'OUTBOX_ADMIN_RATE_LIMIT_MAX_REQUESTS',
      120,
    );

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const current = this.bucket.get(key) ?? { hits: [] };

    current.hits = current.hits.filter((hit) => hit >= windowStart);
    if (current.hits.length >= maxRequests) {
      throw new HttpException(
        `Rate limit administrativo do Outbox excedido. Limite: ${maxRequests} requisições em ${windowSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.hits.push(now);
    this.bucket.set(key, current);

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }

    return request.ip || request.socket.remoteAddress || 'unknown-ip';
  }

  private getPositiveIntEnv(envName: string, fallback: number): number {
    const raw = this.configService.get<string>(envName);
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
