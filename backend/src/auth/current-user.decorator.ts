import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): JwtUser => context.switchToHttp().getRequest().user,
);
