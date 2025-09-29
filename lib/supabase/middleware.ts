import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const path = request.nextUrl.pathname

  // Always allow root and auth routes through without checks
  if (path === "/" || path.startsWith("/auth/")) {
    return supabaseResponse
  }

  // For all other routes, check authentication
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Redirect to login if not authenticated
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    // On error, redirect to login to be safe
    console.error("[v0] Middleware auth error:", error)
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }
}
