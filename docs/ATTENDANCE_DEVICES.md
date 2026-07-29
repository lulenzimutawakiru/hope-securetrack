# ZKTeco & Hikvision Attendance Machine Integration

## Overview

Hope SecureTrack receives clock punches from biometric terminals and records them as attendance events.

| Vendor | Protocols | Endpoint |
|--------|-----------|----------|
| **ZKTeco** | JSON push, ADMS/ICLOCK ATTLOG | `/api/attendance/devices/zkteco/push`, `/api/attendance/devices/zkteco/iclock` |
| **Hikvision** | ISAPI AccessControllerEvent | `/api/attendance/devices/hikvision/event` |

## Setup (admin UI)

1. **Attendance → Machine Integrations**
2. Open **ZKTeco Setup** or **Hikvision Setup** and copy the push URL (includes company `push_token`).
3. **Devices** — register each terminal (`vendor`, `model`, `ip`, `serial`, location).
4. **Device User Mapping** — map terminal PIN / `employeeNoString` / card to ERP `employee_number`.
5. Punch on device → appears in **Live attendance**, **Events**, and **Device Punch Queue**.

## Authentication

All device endpoints require the company push token:

- Query: `?token=zk_…` or `?token=hk_…`
- Or header: `X-Device-Token: …` / `Authorization: Bearer …`

Tokens are stored in `att_device_integrations` (seeded per company).

## Data flow

```
Terminal → HTTPS push → API route → att_device_punches
                                 → resolve employee (mapping / employee_number)
                                 → att_events + attendance_records
                                 → device online heartbeat + sync log
```

## Mapping rules

1. `att_device_users` match on `(vendor, device_user_id)` or card number  
2. Else `employees.employee_number` or `payroll_number`  
3. Else punch is stored and event is **flagged** as unmapped  

## Tables (migration 00061)

- `att_device_integrations` — vendor tokens & auto-process flags  
- `att_device_users` — PIN/card → employee  
- `att_device_punches` — raw queue (idempotent via `external_id`)  
- Extended `att_devices` — protocol, port, push flags, totals  

## Notes

- Devices on private LAN need a reverse proxy / cloud ADMS / public HTTPS URL (e.g. production Vercel domain).
- Pull/SDK local collection can be added later; current path is **push**.
