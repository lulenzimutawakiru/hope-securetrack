export * from "./types";
export * from "./codes";
export * from "./designer";
export * from "./security";
export * from "./ai";
export * from "./service";
export * from "./pdf";
export * from "./automation";
// Re-export Niimbot helpers for convenience
export {
  NIIMBOT_MODELS,
  discoverNiimbotBluetooth,
  discoverAnyBluetoothPrinter,
  listSystemPrinters,
  webBluetoothSupported,
  isNiimbotName,
  guessModel,
  type DiscoveredPrinter,
} from "@/lib/niimbot";
