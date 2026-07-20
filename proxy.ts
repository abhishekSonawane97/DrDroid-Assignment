import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_REQUIRED_PREFIXES = ["/dashboard", "/paywall"];
const UNLOCK_REQUIRED_PREFIXES = ["/dashboard"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    path.startsWith(prefix),
  );
  const requiresUnlock = UNLOCK_REQUIRED_PREFIXES.some((prefix) =>
    path.startsWith(prefix),
  );

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Only queried when there's a user and the route actually cares about
  // lock state (covers /dashboard, /paywall, and /login below).
  let isUnlocked: boolean | null = null;
  if (user && (requiresUnlock || path === "/paywall" || path === "/login")) {
    const { data } = await supabase
      .from("users")
      .select("is_unlocked")
      .eq("id", user.id)
      .single();
    isUnlocked = data?.is_unlocked ?? false;
  }

  if (requiresUnlock && user && !isUnlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/paywall";
    return NextResponse.redirect(url);
  }

  if (path === "/paywall" && isUnlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (path === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = isUnlocked ? "/dashboard" : "/paywall";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
