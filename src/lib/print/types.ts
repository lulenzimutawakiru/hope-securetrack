/** Enterprise Print Platform types */

export const PRINT_LIFECYCLE = [
  "Register",
  "Discover",
  "Design",
  "Queue",
  "Print",
  "Verify",
  "Audit",
] as const;

export const PRINTER_TYPES = [
  { value: "laser", label: "Laser" },
  { value: "inkjet", label: "Inkjet" },
  { value: "thermal", label: "Thermal" },
  { value: "label", label: "Label" },
  { value: "card", label: "Card" },
  { value: "industrial", label: "Industrial" },
  { value: "pos", label: "POS Receipt" },
  { value: "dot_matrix", label: "Dot Matrix" },
  { value: "plotter", label: "Plotter" },
  { value: "mfp", label: "Multifunction (MFP)" },
] as const;

export const PRINTER_BRANDS = {
  office: ["HP", "Canon", "Epson", "Brother", "Xerox", "Ricoh", "Kyocera", "Lexmark"],
  thermal: ["Zebra", "Niimbot", "TSC", "Honeywell", "Godex", "Bixolon", "SATO", "Toshiba TEC", "Citizen"],
  card: ["Evolis", "HID Fargo", "Zebra Card", "Magicard", "Entrust"],
  receipt: ["Epson TM", "Star Micronics", "Rongta", "XPrinter", "Sunmi"],
} as const;

export const ALL_BRANDS = [
  ...PRINTER_BRANDS.office,
  ...PRINTER_BRANDS.thermal,
  ...PRINTER_BRANDS.card,
  ...PRINTER_BRANDS.receipt,
] as const;

export const CONNECTION_TYPES = [
  { value: "bluetooth", label: "Bluetooth" },
  { value: "usb", label: "USB" },
  { value: "network", label: "Network / IP" },
  { value: "system", label: "System / OS" },
  { value: "agent", label: "Print Agent" },
] as const;

export const LABEL_SIZES = [
  { value: "20x10", w: 20, h: 10, label: "20×10 mm" },
  { value: "30x20", w: 30, h: 20, label: "30×20 mm" },
  { value: "40x30", w: 40, h: 30, label: "40×30 mm" },
  { value: "50x30", w: 50, h: 30, label: "50×30 mm" },
  { value: "50x50", w: 50, h: 50, label: "50×50 mm" },
  { value: "70x40", w: 70, h: 40, label: "70×40 mm" },
  { value: "100x150", w: 100, h: 150, label: "100×150 mm shipping" },
  { value: "cr80", w: 85.6, h: 54, label: "CR80 Card" },
  { value: "a4", w: 210, h: 297, label: "A4" },
] as const;

export const BARCODE_SYMBOLOGIES = [
  { value: "qr", label: "QR Code" },
  { value: "code128", label: "Code 128" },
  { value: "code39", label: "Code 39" },
  { value: "ean13", label: "EAN-13" },
  { value: "upc", label: "UPC" },
  { value: "gs1_128", label: "GS1-128" },
  { value: "pdf417", label: "PDF417" },
  { value: "datamatrix", label: "Data Matrix" },
  { value: "aztec", label: "Aztec" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "qr_auth", label: "QR Auth Label" },
  { value: "product_label", label: "Product Label" },
  { value: "barcode", label: "Barcode Label" },
  { value: "shipping", label: "Shipping Label" },
  { value: "shelf", label: "Shelf Label" },
  { value: "pallet", label: "Pallet Label" },
  { value: "invoice", label: "Invoice" },
  { value: "po", label: "Purchase Order" },
  { value: "quotation", label: "Quotation" },
  { value: "delivery_note", label: "Delivery Note" },
  { value: "grn", label: "Goods Received Note" },
  { value: "receipt", label: "Receipt" },
  { value: "id_card", label: "ID Card" },
  { value: "visitor", label: "Visitor Badge" },
  { value: "certificate", label: "Certificate" },
  { value: "report", label: "Report" },
  { value: "contract", label: "Contract" },
  { value: "work_order", label: "Work Order" },
  { value: "security", label: "Security Document" },
  { value: "packaging", label: "Packaging Artwork" },
] as const;

export const QUEUE_STATUSES = [
  "queued",
  "sending",
  "printing",
  "completed",
  "failed",
  "cancelled",
  "held",
] as const;

export const DESIGNER_ELEMENTS = [
  { type: "logo", label: "Company Logo" },
  { type: "text", label: "Text" },
  { type: "qr", label: "QR Code" },
  { type: "barcode", label: "Barcode" },
  { type: "serial", label: "Serial Number" },
  { type: "batch", label: "Batch Number" },
  { type: "date", label: "Date" },
  { type: "price", label: "Price" },
  { type: "sku", label: "SKU" },
  { type: "image", label: "Image" },
  { type: "shape", label: "Shape" },
  { type: "table", label: "Table" },
  { type: "security", label: "Security Mark" },
  { type: "variable", label: "Dynamic Variable" },
] as const;

export interface LabelElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  field?: string;
  text?: string;
  symbology?: string;
  size?: number;
}

export interface CanvasLayout {
  canvas: { w: number; h: number };
  elements: LabelElement[];
}
