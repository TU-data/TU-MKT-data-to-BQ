import { cookies } from "next/headers";
import { createHash } from "crypto";

export const SESSION_COOKIE_NAME = "mkt-session";

export function resolveAppPassword(): string | undefined {
  return process.env.APP_LOGIN_PASSWORD ?? process.env.APP_PASSWORD;
}

export function getExpectedSessionValue(): string | undefined {
  const password = resolveAppPassword();
  if (!password) {
    return undefined;
  }

  return createHash('sha256').update(password).digest('hex');
}

export async function isAuthenticated(): Promise<boolean> {
  const expectedSession = getExpectedSessionValue();
  if (!expectedSession) {
    return false;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return false;
  }

  return sessionCookie.value === expectedSession;
}
