import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const logged = !!req.auth;
  const role = req.auth?.user?.role;
  const isAdmin = role === "ADMIN";
  const isEmployee = role === "EMPLOYEE";

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!logged) {
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // JWT bez role (např. špatný AUTH_SECRET na serveru) — nepingpongovat admin ↔ employee
  if (!isAdmin && !isEmployee) {
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login") {
    const dest = isAdmin ? "/admin" : "/employee";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  if (pathname === "/") {
    const dest = isAdmin ? "/admin" : "/employee";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  if (pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(
      new URL(isEmployee ? "/employee" : "/login", req.nextUrl),
    );
  }

  if (pathname.startsWith("/employee") && !isEmployee) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin" : "/login", req.nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
