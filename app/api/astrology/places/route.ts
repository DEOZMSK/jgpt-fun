import { NextResponse, type NextRequest } from "next/server";
import { allowedLabRequest } from "../../../../lib/lab-request";
import { parsePlaceSearch, searchPlaces, PlaceSearchError } from "../../../../lib/astrology/place-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status: number) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });

export async function GET(request: NextRequest) {
  if (!allowedLabRequest(request, true)) return json({ code: "forbidden" }, 403);
  try {
    const params = request.nextUrl.searchParams;
    if (Array.from(params.keys()).some(key => key !== "q" && key !== "language") || params.getAll("q").length !== 1 || params.getAll("language").length !== 1) throw new PlaceSearchError("invalid_query");
    const { query, language } = parsePlaceSearch(params.get("q"), params.get("language"));
    return json({ places: await searchPlaces(query, language, "account") }, 200);
  } catch (error) {
    if (error instanceof PlaceSearchError && error.code === "invalid_query") return json({ code: "invalid_query" }, 400);
    return json({ code: "places_unavailable" }, 503);
  }
}
