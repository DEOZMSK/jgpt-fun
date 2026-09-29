import { NextResponse, type NextRequest } from "next/server";
import { AstrologyInputError } from "../../../../lib/astrology/contracts";
import { allowedLabRequest, acquireCalculation } from "../../../../lib/lab-request";
import { readBoundedUtf8Stream, BoundedRequestBodyError } from "../../../../lib/bounded-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(value: unknown, status: number) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: NextRequest) {
  if (!allowedLabRequest(request)) return json({ code: "forbidden" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") return json({ code: "unsupported_media_type" }, 415);
  const release = acquireCalculation(request);
  if (!release) return json({ code: "rate_limited", message: "Please wait before calculating again." }, 429);
  try {
    const input: unknown = JSON.parse(await readBoundedUtf8Stream(request.body, 4_096));
    if (input && typeof input === "object" && !Array.isArray(input) && "operation" in input && input.operation === "day-panchanga") {
      const { operation: _operation, ...dayInput } = input;
      const { calculateDayPanchanga } = await import("../../../../lib/astrology/day-panchanga-core");
      return json({ day: calculateDayPanchanga(dayInput) }, 200);
    }
    if (input && typeof input === "object" && !Array.isArray(input) && "operation" in input && input.operation === "saturn-transits") {
      const { operation: _operation, ...rangeInput } = input;
      const { calculateSaturnTransits } = await import("../../../../lib/astrology/saturn-transit-core");
      return json({ timeline: calculateSaturnTransits(rangeInput) }, 200);
    }
    if (input && typeof input === "object" && !Array.isArray(input) && "operation" in input && input.operation === "month-panchanga") {
      const { operation: _operation, ...calendarInput } = input;
      const { calculateMonthPanchanga } = await import("../../../../lib/astrology/month-panchanga-core");
      return json({ calendar: calculateMonthPanchanga(calendarInput) }, 200);
    }
    if (input && typeof input === "object" && !Array.isArray(input) && "operation" in input && input.operation === "transit") {
      const { operation: _operation, ...transitInput } = input;
      const { calculateTransit } = await import("../../../../lib/astrology/transit-core");
      return json({ transit: calculateTransit(transitInput) }, 200);
    }
    if (input && typeof input === "object" && !Array.isArray(input) && "operation" in input && input.operation === "year-transits") {
      const { operation: _operation, ...yearInput } = input;
      const { calculateYearTransits } = await import("../../../../lib/astrology/year-transit-core");
      return json({ timeline: calculateYearTransits(yearInput) }, 200);
    }
    const { calculateAstrology } = await import("../../../../lib/astrology/engine-core");
    return json({ calculation: calculateAstrology(input) }, 200);
  } catch (error) {
    if (error instanceof AstrologyInputError) return json({ code: error.code, message: error.message }, 422);
    if (error instanceof SyntaxError) return json({ code: "invalid_json", message: "Check the birth details." }, 400);
    if (error instanceof BoundedRequestBodyError) return json({ code: "invalid_body", message: "The request is too large or invalid." }, 400);
    return json({ code: "engine_unavailable", message: "The calculation engine is temporarily unavailable." }, 503);
  } finally { release(); }
}
