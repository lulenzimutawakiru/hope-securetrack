export * from "./types";
export * from "./events";
export * from "./service";
export { provisionTenant } from "./provision";
export {
  TENANT_WIZARD_STEPS,
  COUNTRY_DEFAULTS,
  resolveLocaleDefaults,
  validateAdminPassword,
  setupProgressSummary,
  wizardHrefForKey,
} from "./onboarding";
export {
  cpanelListTenants,
  cpanelGetTenant,
  cpanelMutateTenant,
  cpanelCreateTenant,
  cpanelDeleteTenant,
  cpanelSuggestSlug,
  cpanelOverview,
  type PlatformTenantRow,
  type PlatformTenantDetail,
  type TenantLifecycleAction,
} from "./cpanel";
export {
  getCommandCenterSnapshot,
  listAllCompanies,
  listAllUsers,
  CONTROL_PLANE_NAV,
  type CommandCenterSnapshot,
  type ControlPlaneLayer,
} from "./control-plane";
export {
  CONTROL_PLANE_CAPABILITIES,
  ACCESS_MATRIX,
  ERP_MODULE_CATALOG,
  SUBSCRIPTION_PLANS,
  getPlanEntitlements,
  PROVISIONING_WORKFLOW,
  type ControlPlaneCapability,
  type PlanEntitlements,
  type SubscriptionPlanCode,
} from "./control-plane-registry";
export * from "./admin-console";
export {
  generateTenantEncryptionKey,
  tenantDomainFromSlug,
  type TenantEnterpriseConfig,
} from "./tenant-crypto";
export {
  PLATFORM_STAFF_ROLES,
  PLATFORM_ROLE_CAPABILITY_MATRIX,
  isPlatformStaff,
  resolvePlatformRole,
  roleCanAccessCapability,
  staffCanAccess,
  capabilitiesForRole,
  capabilityIdsForRole,
  resolveCapabilityForPath,
  type PlatformStaffRole,
  type PlatformStaffRoleDef,
  type ResolvedPlatformRole,
} from "./staff";
