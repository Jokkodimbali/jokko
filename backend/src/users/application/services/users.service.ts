import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../ports/users-repository.port';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  async me(userId: string) {
    const user = await this.usersRepository.findMeById(userId);

    if (!user) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }

    return user;
  }
}
