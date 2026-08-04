export * from "./types";
export * from "./config";
export * from "./madapi-codes";
export {
  verifyCustomersKyc,
  verifyCustomersKycPost,
  verifyCustomerSingle,
  checkMsisdnActive,
  verifyKycScore,
  verifyNameScore,
  verifyAddressScore,
  verifyBiometric,
  getIdentityStatus,
} from "./client";
export {
  runCompanyKycVerification,
  runCompanyKycVerificationPost,
  runCompanyKycSingle,
  runCompanyKycCheckMsisdn,
  runCompanyKycScore,
  runCompanyKycBiometric,
  runCompanyKycIdentityStatus,
  listKycVerifications,
} from "./service";