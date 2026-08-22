import { SetMetadata } from "@nestjs/common";
import { AuthenticatedUser } from "../common/tenant/tenant.types";

export const ROLES_KEY = "roles";
export const Roles = (...roles: AuthenticatedUser["role"][]) =>
  SetMetadata(ROLES_KEY, roles);
