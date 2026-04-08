import { type UsersRepositoryPort } from './ports/users-repository.port';
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: UsersRepositoryPort);
    me(userId: string): Promise<{
        success: boolean;
        data: import("./ports/users-repository.port").UserMeView;
    }>;
}
