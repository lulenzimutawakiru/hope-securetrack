export function hasPermission(
  userPermissions: string[] | undefined,
  required: string
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes("admin")) return true;
  return userPermissions.includes(required);
}
