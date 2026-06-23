import { createPwaIcon } from "@/lib/pwaIcon";

export const runtime = "edge";
export const contentType = "image/png";

export function GET() {
  return createPwaIcon(192);
}
