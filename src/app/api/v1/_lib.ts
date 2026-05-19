import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";

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

export async function parseJsonBody<S extends ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ data: z.infer<S>; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { data: null, error: NextResponse.json({ error: "invalid json body" }, { status: 400 }) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "validation failed", issues: result.error.flatten() },
        { status: 400 }
      )
    };
  }
  return { data: result.data, error: null };
}

export function parseSearchParams<S extends ZodTypeAny>(
  url: URL,
  schema: S
): { data: z.infer<S>; error: null } | { data: null; error: NextResponse } {
  const params = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "validation failed", issues: result.error.flatten() },
        { status: 400 }
      )
    };
  }
  return { data: result.data, error: null };
}
