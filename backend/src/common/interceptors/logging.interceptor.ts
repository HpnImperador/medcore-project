import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface RequestWithUser {
  method: string;
  originalUrl?: string;
  url: string;
  ip?: string;
  user?: {
    userId?: string;
    email?: string;
  };
}

interface ResponseLike {
  statusCode?: number;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<ResponseLike>();

    const method = request.method;
    const path = request.originalUrl ?? request.url;
    const ip = request.ip ?? 'ip-indisponivel';
    const actor = request.user?.userId ?? request.user?.email ?? 'anonimo';

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = response.statusCode ?? 200;

        this.logger.log(
          `[${method}] ${path} ${statusCode} ${durationMs}ms | actor=${actor} | ip=${ip}`,
        );
      }),
    );
  }
}
