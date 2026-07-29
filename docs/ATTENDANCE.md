# Enterprise Workforce Attendance Platform

Geofence-enforced attendance with multi-factor verification and biometric terminal support.

## Features

- Secure clock-in/out (GPS, geofence, Wi-Fi, QR, NFC, beacon, field assignment)
- Locations & geofences (HQ, branch, factory, warehouse, project/customer sites)
- Biometric devices (ZKTeco, Suprema, HID, Hikvision, BioTime-compatible, …)
- Shifts, rotations, swaps, breaks, holidays, policies
- Corrections & multi-level approvals
- Field workforce assignments
- Fraud violations & AI insights
- Payroll-ready hours / OT / late minutes
- Live attendance board, reports CSV, audit log

## Routes

Base: `/dashboard/attendance`  
Menu: `src/lib/attendance/menu.ts`

## Configure locations with live onsite GPS

1. Go onsite to the gate/entrance  
2. Open **Attendance → Locations** (`/dashboard/attendance/locations`)  
3. **Add location (onsite)** → **Use live GPS here**  
4. Set **radius** (25–500 m) and save  
5. Matching `att_geofences` row is created/updated automatically  
6. Use **Test** on a location row to verify you are inside with live GPS  

Shared hook: `src/hooks/use-live-gps.ts`

## Secure clock flow

`processClock` in `src/lib/attendance/engine.ts`:

1. Live GPS watch (high accuracy)  
2. Geofence match (or authorized field assignment)  
3. Optional Wi-Fi / beacon / QR / NFC factors  
4. Duplicate window  
5. Write `att_events` + `attendance_records`  
6. Notifications + audit + violations on failure  

Clock-in button stays disabled until inside a configured geofence (unless field work is checked).  

## Permissions

`att.view` · `att.manage` · `att.clock` · `att.approve` · `att.devices` · `att.field` · `att.ai` · `att.admin`

## Database

Migration: `supabase/migrations/20260101000058_enterprise_workforce_attendance.sql`

Extends `attendance_records`, `shift_templates`, `shift_assignments` and adds `att_*` tables.
