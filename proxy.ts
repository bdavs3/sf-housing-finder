import { NextRequest, NextResponse } from "next/server"

export function proxy(req: NextRequest) {
  const user = process.env.SITE_USER
  const pass = process.env.SITE_PASS

  if (!user || !pass) return NextResponse.next()

  const auth = req.headers.get("authorization")
  if (auth) {
    const [scheme, encoded] = auth.split(" ")
    if (scheme === "Basic" && encoded) {
      const [u, p] = atob(encoded).split(":")
      if (u === user && p === pass) return NextResponse.next()
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SF Housing Finder"' },
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
