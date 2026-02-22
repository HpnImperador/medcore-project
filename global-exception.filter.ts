import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails: any = null;

    // Tratamento de Erros HTTP (NestJS)
    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();
      
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        message = (response as any).message || message;
        errorDetails = (response as any).error || null;
      }
    }
    // Tratamento de Erros do Prisma
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          httpStatus = HttpStatus.CONFLICT;
          message = 'Conflict: Unique constraint failed';
          errorDetails = {
            fields: exception.meta?.target,
          };
          break;
        case 'P2025': // Record not found
          httpStatus = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        default:
          httpStatus = HttpStatus.BAD_REQUEST;
          message = `Database error: ${exception.code}`;
          break;
      }
    }
    // Tratamento de Erros Genéricos
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log do erro (apenas se for 500 ou erro desconhecido crítico)
    if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    const responseBody = {
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      ...(errorDetails && { details: errorDetails }),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}