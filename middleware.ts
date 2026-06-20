import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-doi-trong-production");

const PROTECTED = ["/assistant", "/bookings", "/checkout", "/booking"];
const ADMIN_ONLY = ["/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = [...PROTECTED, ...ADMIN_ONLY].some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("resort_session")?.value;
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);

  if (!token) return NextResponse.redirect(loginUrl);

  try {
    const { payload } = await jwtVerify(token, secret());
    if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/assistant/:path*", "/bookings/:path*", "/checkout/:path*", "/booking/:path*", "/admin/:path*"],
};
