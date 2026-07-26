/**
 * Niimbot Bluetooth discovery helpers (Web Bluetooth API).
 * Works in Chromium-based browsers with a secure context (HTTPS/localhost).
 */

export const NIIMBOT_MODELS = [
  "B1",
  "B18",
  "B21",
  "B3S",
  "D11",
  "D110",
  "D101",
  "B203",
  "B1S",
] as const;

export interface DiscoveredPrinter {
  id: string;
  name: string;
  model: string;
  transport: "bluetooth" | "usb" | "network" | "system";
  bluetoothAddress?: string;
  deviceId?: string;
  rawName?: string;
  source: "web_bluetooth" | "manual" | "system" | "agent";
}

/** Common Niimbot BLE name patterns */
export function isNiimbotName(name: string): boolean {
  const n = name.toUpperCase();
  return (
    n.includes("NIIMBOT") ||
    n.includes("B21") ||
    n.includes("B1 ") ||
    n.startsWith("B1") ||
    n.includes("D11") ||
    n.includes("D110") ||
    n.includes("B18") ||
    n.includes("B3S")
  );
}

export function guessModel(name: string): string {
  const n = name.toUpperCase();
  for (const model of NIIMBOT_MODELS) {
    if (n.includes(model)) return model;
  }
  if (n.includes("NIIMBOT")) return "Niimbot";
  return "Unknown";
}

export function webBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Prompt user to pick a Bluetooth device (Niimbot-friendly filters).
 * Note: browsers only return the device the user selects, not a full scan list.
 */
export async function discoverNiimbotBluetooth(): Promise<DiscoveredPrinter | null> {
  if (!webBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth is not supported in this browser. Use Chrome/Edge on HTTPS, or register the printer manually."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: false,
    filters: [
      { namePrefix: "B21" },
      { namePrefix: "B1" },
      { namePrefix: "D11" },
      { namePrefix: "D110" },
      { namePrefix: "Niimbot" },
      { namePrefix: "NIIMBOT" },
      { namePrefix: "B18" },
      { namePrefix: "B3S" },
      // Some firmwares expose only manufacturer data — allow optional services scan
      { services: ["0000ff00-0000-1000-8000-00805f9b34fb"] },
    ],
    optionalServices: [
      "0000ff00-0000-1000-8000-00805f9b34fb",
      "0000ae30-0000-1000-8000-00805f9b34fb",
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    ],
  });

  if (!device) return null;

  const name = device.name || "Niimbot Printer";
  return {
    id: device.id,
    name,
    model: guessModel(name),
    transport: "bluetooth",
    deviceId: device.id,
    rawName: name,
    source: "web_bluetooth",
  };
}

/** Fallback: accept any BLE device (when filters miss the printer) */
export async function discoverAnyBluetoothPrinter(): Promise<DiscoveredPrinter | null> {
  if (!webBluetoothSupported()) {
    throw new Error("Web Bluetooth not supported");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "0000ff00-0000-1000-8000-00805f9b34fb",
      "0000ae30-0000-1000-8000-00805f9b34fb",
    ],
  });
  if (!device) return null;
  const name = device.name || `BLE ${device.id.slice(0, 8)}`;
  return {
    id: device.id,
    name,
    model: guessModel(name),
    transport: "bluetooth",
    deviceId: device.id,
    rawName: name,
    source: "web_bluetooth",
  };
}

/** List printers exposed to the browser print system (when available) */
export async function listSystemPrinters(): Promise<DiscoveredPrinter[]> {
  // Experimental Browser Print API (Chrome)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (nav.printing?.getPrinters) {
    try {
      const printers = await nav.printing.getPrinters();
      return (printers || []).map(
        (p: { printerName?: string; name?: string }, i: number) => {
          const name = p.printerName || p.name || `System Printer ${i + 1}`;
          return {
            id: `sys-${name}`,
            name,
            model: isNiimbotName(name) ? guessModel(name) : "System",
            transport: "system" as const,
            source: "system" as const,
          };
        }
      );
    } catch {
      return [];
    }
  }
  return [];
}
