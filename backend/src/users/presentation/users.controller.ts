import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/security/current-user.decorator';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { UsersService } from '../application/users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.me(user.sub);
  }
}
