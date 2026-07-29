export type DeviceVendor = "zkteco" | "hikvision" | "generic";

export type DevicePunchInput = {
  companyId: string;
  vendor: DeviceVendor;
  deviceCode?: string;
  deviceSerial?: string;
  deviceUserId: string;
  punchTime: string; // ISO
  punchType?: "auto" | "clock_in" | "clock_out" | "break_start" | "break_end" | "check";
  verifyMode?: string;
  externalId?: string;
  cardNumber?: string;
  raw?: Record<string, unknown>;
};

export type IngestResult = {
  ok: boolean;
  punchCode?: string;
  processStatus: string;
  eventCode?: string;
  message?: string;
  employeeName?: string;
};
