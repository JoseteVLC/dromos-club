import "server-only";
import QRCode from "qrcode";

/** QR en SVG (negro sobre blanco, que es lo que mejor leen las cámaras). */
export async function qrSvg(text: string, margin = 1) {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin, color: { dark: "#0C0D10", light: "#FFFFFF" } });
}

export const joinUrl = (base: string, code: string) => `${base}/unirse/${code}`;
