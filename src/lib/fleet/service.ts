import { createClient } from "@/lib/supabase/crud-compat";

export async function getFleetDashboardStats(companyId: string) {
  const sb = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [
    vehicles,
    active,
    maint,
    available,
    assigned,
    driversAvail,
    activeTrips,
    delayed,
    maintDue,
    insuranceExp,
    { data: fuelToday },
    { data: fuelMonth },
    { data: odoToday },
    { data: costs },
    gpsOnline,
  ] = await Promise.all([
    sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true).is("deleted_at", null),
    sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "maintenance"),
    sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "available"),
    sb.from("fleet_vehicle_assignments").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
    sb.from("fleet_drivers").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "available").is("deleted_at", null),
    sb.from("fleet_trips").select("*", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["dispatched", "in_progress"]),
    sb.from("fleet_trips").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "delayed"),
    sb.from("fleet_maintenance_plans").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
    sb.from("fleet_insurance_policies").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
    sb.from("fleet_fuel_transactions").select("total_cost,litres").eq("company_id", companyId).eq("txn_date", today).is("deleted_at", null),
    sb.from("fleet_fuel_transactions").select("total_cost,litres").eq("company_id", companyId).gte("txn_date", monthStart).is("deleted_at", null),
    sb.from("fleet_odometer_logs").select("odometer_km").eq("company_id", companyId).eq("reading_date", today).is("deleted_at", null),
    sb.from("fleet_costs").select("amount,cost_type").eq("company_id", companyId).gte("cost_date", monthStart).is("deleted_at", null),
    sb.from("fleet_gps_devices").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "online").is("deleted_at", null),
  ]);

  const fuelCostToday = (fuelToday || []).reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const fuelCostMonth = (fuelMonth || []).reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const mileageToday = (odoToday || []).reduce((s, r) => s + Number(r.odometer_km || 0), 0);
  const maintCost = (costs || [])
    .filter((c) => ["repair", "maintenance"].includes(String(c.cost_type)))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCost = (costs || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalV = vehicles.count ?? 0;
  const util =
    totalV > 0
      ? Math.round((((totalV - (available.count ?? 0)) / totalV) * 1000)) / 10
      : 0;
  const health = Math.max(
    0,
    Math.min(
      100,
      100 -
        (maint.count ?? 0) * 5 -
        (delayed.count ?? 0) * 3 +
        Math.min(10, (driversAvail.count ?? 0))
    )
  );

  return {
    totalVehicles: totalV,
    activeVehicles: active.count ?? 0,
    inMaintenance: maint.count ?? 0,
    available: available.count ?? 0,
    assigned: assigned.count ?? 0,
    fuelCostToday,
    fuelCostMonth,
    mileageToday,
    maintenanceDue: maintDue.count ?? 0,
    insurancePolicies: insuranceExp.count ?? 0,
    driversAvailable: driversAvail.count ?? 0,
    activeTrips: activeTrips.count ?? 0,
    delayedTrips: delayed.count ?? 0,
    gpsOnline: gpsOnline.count ?? 0,
    fleetHealth: health,
    utilization: util,
    maintenanceCost: maintCost,
    costPerKm: mileageToday > 0 ? Math.round((totalCost / mileageToday) * 100) / 100 : 0,
    totalCostMonth: totalCost,
  };
}

export async function getLiveVehiclePositions(companyId: string) {
  const sb = createClient();
  const { data: vehicles } = await sb
    .from("fleet_vehicles")
    .select("id,registration,make,model,status,current_lat,current_lng,last_gps_at,assigned_driver_name,gps_tracker_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(300);

  const { data: latest } = await sb
    .from("fleet_gps_locations")
    .select("vehicle_id,registration,lat,lng,speed_kmh,ignition,recorded_at,driver_name")
    .eq("company_id", companyId)
    .order("recorded_at", { ascending: false })
    .limit(200);

  const byVehicle = new Map<string, (typeof latest extends (infer U)[] | null ? U : never)>();
  for (const row of latest || []) {
    const key = String(row.vehicle_id || row.registration || "");
    if (key && !byVehicle.has(key)) byVehicle.set(key, row);
  }

  return (vehicles || []).map((v) => {
    const loc = byVehicle.get(String(v.id)) || byVehicle.get(String(v.registration));
    return {
      ...v,
      lat: loc?.lat ?? v.current_lat,
      lng: loc?.lng ?? v.current_lng,
      speed_kmh: loc?.speed_kmh ?? 0,
      ignition: loc?.ignition ?? false,
      last_seen: loc?.recorded_at ?? v.last_gps_at,
      driver_name: loc?.driver_name ?? v.assigned_driver_name,
    };
  });
}
