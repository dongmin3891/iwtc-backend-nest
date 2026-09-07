import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.getMessage(exceptionResponse, exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      code: -1,
      message,
      data: null,
    });
  }

  private getMessage(response: unknown, exception: unknown): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    return exception instanceof Error
      ? exception.message
      : '서버 내부 오류가 발생했습니다.';
  }
}
