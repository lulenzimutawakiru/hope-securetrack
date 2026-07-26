export function generateReamSerial(index: number, date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `RM-${dateStr}-${String(index).padStart(5, "0")}`;
}

export function generateCartonSerial(index: number, date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `CT-${dateStr}-${String(index).padStart(5, "0")}`;
}

export function parseSerial(serial: string): {
  prefix: string;
  date: string;
  index: number;
} | null {
  const match = serial.match(/^([A-Z]{2})-(\d{8})-(\d{5})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    date: match[2],
    index: parseInt(match[3], 10),
  };
}
