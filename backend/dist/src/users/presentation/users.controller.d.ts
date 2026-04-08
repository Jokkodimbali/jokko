import type { AuthUser } from '../../auth/security/auth-user.type';
import { UsersService } from '../application/users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(user: AuthUser): Promise<{
        success: boolean;
        data: import("../application/ports/users-repository.port").UserMeView;
    }>;
}
