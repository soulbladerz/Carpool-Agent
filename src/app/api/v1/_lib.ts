import { NextResponse } from "next/server";

export function requireApiKey(request: Request) {
  const key = request.headers.get("x-api-key");
  if (!key || key !== process.env.API_INTEGRATION_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
