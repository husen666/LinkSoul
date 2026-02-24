import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.BAD_REQUEST;
    let message = '数据库操作失败';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = '数据已存在，请勿重复提交';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = '目标数据不存在或已被删除';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = '数据关联校验失败';
        break;
      default:
        status = HttpStatus.BAD_REQUEST;
        message = '请求数据无效';
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
