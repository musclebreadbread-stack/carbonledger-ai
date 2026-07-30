/**
 * Role-Based Access Control (RBAC) System
 */

export enum Role {
  SUPER_ADMIN = "super_admin",
  COMPANY_ADMIN = "company_admin",
  SITE_ADMIN = "site_admin",
  REVIEWER = "reviewer",
  AUDITOR = "auditor",
  VIEWER = "viewer",
  CONSULTANT = "consultant",
}

export enum Permission {
  READ = "read",
  WRITE = "write",
  APPROVE = "approve",
  ADMIN = "admin",
  AUDIT = "audit",
  DELETE = "delete",
  EXPORT = "export",
}

/**
 * Role-Permission mapping
 * Defines what each role is allowed to do
 */
export const RolePermissionMap: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.APPROVE,
    Permission.ADMIN,
    Permission.AUDIT,
    Permission.DELETE,
    Permission.EXPORT,
  ],
  [Role.COMPANY_ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.APPROVE,
    Permission.ADMIN,
    Permission.EXPORT,
  ],
  [Role.SITE_ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.APPROVE,
    Permission.EXPORT,
  ],
  [Role.REVIEWER]: [
    Permission.READ,
    Permission.APPROVE,
    Permission.EXPORT,
  ],
  [Role.AUDITOR]: [
    Permission.READ,
    Permission.AUDIT,
    Permission.EXPORT,
  ],
  [Role.VIEWER]: [
    Permission.READ,
  ],
  [Role.CONSULTANT]: [
    Permission.READ,
    Permission.EXPORT,
  ],
};

/**
 * Check if a user with a given role has a specific permission
 */
export function hasPermission(userRole: Role, permission: Permission): boolean {
  const permissions = RolePermissionMap[userRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(userRole, p));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(userRole, p));
}

/**
 * Factory function to create a role-checking middleware
 */
export function requireRole(...roles: Role[]) {
  return (userRole: Role): boolean => {
    return roles.includes(userRole);
  };
}

/**
 * Factory function to create a permission-checking middleware
 */
export function requirePermission(...permissions: Permission[]) {
  return (userRole: Role): boolean => {
    return permissions.every((p) => hasPermission(userRole, p));
  };
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
  return RolePermissionMap[role] || [];
}

/**
 * Navigation items visible to each role
 */
export const RoleNavigationMap: Record<Role, string[]> = {
  [Role.SUPER_ADMIN]: ["dashboard", "emissions", "emission-factors", "reports", "suppliers", "targets", "settings", "audit-log"],
  [Role.COMPANY_ADMIN]: ["dashboard", "emissions", "emission-factors", "reports", "suppliers", "targets", "settings", "audit-log"],
  [Role.SITE_ADMIN]: ["dashboard", "emissions", "emission-factors", "reports", "targets"],
  [Role.REVIEWER]: ["dashboard", "emissions", "reports", "audit-log"],
  [Role.AUDITOR]: ["dashboard", "emissions", "emission-factors", "reports", "audit-log"],
  [Role.VIEWER]: ["dashboard", "emissions", "reports"],
  [Role.CONSULTANT]: ["dashboard", "emissions", "emission-factors", "reports"],
};
