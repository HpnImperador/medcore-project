import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<{ url: string }>();
    const response = ctx.getResponse<unknown>();

    const errorResponse = this.mapException(exception, request.url);

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `Erro interno em ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    httpAdapter.reply(response, errorResponse, errorResponse.statusCode);
  }

  private mapException(exception: unknown, path: string): ErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return this.buildError(status, payload, path);
      }

      if (typeof payload === 'object' && payload !== null) {
        const typedPayload = payload as {
          message?: string | string[];
          error?: string;
        };

        return this.buildError(
          status,
          typedPayload.message ?? 'Erro HTTP',
          path,
          typedPayload.error,
        );
      }

      return this.buildError(status, 'Erro HTTP', path);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return this.buildError(
          HttpStatus.CONFLICT,
          'Conflito de unicidade no banco de dados.',
          path,
          exception.meta,
        );
      }

      if (exception.code === 'P2025') {
        return this.buildError(
          HttpStatus.NOT_FOUND,
          'Registro não encontrado.',
          path,
        );
      }

      return this.buildError(
        HttpStatus.BAD_REQUEST,
        `Erro de banco de dados: ${exception.code}`,
        path,
      );
    }

    if (exception instanceof Error) {
      return this.buildError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        exception.message,
        path,
      );
    }

    return this.buildError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Erro interno do servidor.',
      path,
    );
  }

  private buildError(
    statusCode: number,
    message: string | string[],
    path: string,
    details?: unknown,
  ): ErrorResponse {
    return {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path,
      ...(details ? { details } : {}),
    };
  }
}
