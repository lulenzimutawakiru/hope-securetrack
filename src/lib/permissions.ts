export type Permission = "manage_settings" | "view_notifications" | "manage_billing" | "admin";

export function hasPermission(
  userPermissions: Permission[] | undefined,
  required: Permission
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes("admin")) return true;
  return userPermissions.includes(required);
}
