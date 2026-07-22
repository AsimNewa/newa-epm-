import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    switch (exception.code) {
      case 'P2002':
        return this.respond(host, new ConflictException('A record with these unique values already exists'));
      case 'P2025':
        return this.respond(host, new NotFoundException('Record not found'));
      default:
        throw exception;
    }
  }

  private respond(host: ArgumentsHost, exception: ConflictException | NotFoundException): void {
    const response = host.switchToHttp().getResponse();
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
