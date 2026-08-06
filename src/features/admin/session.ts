import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "./paths";

export async function getStaffSession() {
  return auth.api.getSession({ headers: await headers() });
}

// The gate for every panel screen and every panel Server Action. Actions call
// it too, not just pages: a rendered page proves who loaded the screen, never
// who sent the request that follows it.
export async function requireStaff() {
  const session = await getStaffSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}
