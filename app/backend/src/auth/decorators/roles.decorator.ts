import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../../common/constants/roles.constants';
import { UserRole } from '../../common/enums/user-role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
