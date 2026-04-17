import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const logged = !!req.auth;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!logged) {
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login") {
    const dest = role === "ADMIN" ? "/admin" : "/employee";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  if (pathname === "/") {
    const dest = role === "ADMIN" ? "/admin" : "/employee";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/employee", req.nextUrl));
  }

  if (pathname.startsWith("/employee") && role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
