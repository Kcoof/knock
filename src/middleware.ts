import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase auth session cookie on every request so Server
 * Components always see a valid session. No-ops when Supabase isn't
 * configured yet (guest mode).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (isSupabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sprites|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
