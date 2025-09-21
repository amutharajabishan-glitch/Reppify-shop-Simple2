// app/api/products/route.js
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const ROOT = process.cwd();
    const jsonPath = path.join(ROOT, "public", "products.json");

    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf8");
      const data = JSON.parse(raw);
      // kleine Sanity-Checks
      if (data && Array.isArray(data.items)) {
        return NextResponse.json(data, { status: 200 });
      }
    }

    // Fallback, falls Datei fehlt/leer ist
    return NextResponse.json({ items: [] }, { status: 200 });
  } catch (err) {
    console.error("API /products error:", err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
