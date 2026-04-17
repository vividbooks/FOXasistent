import { redirect } from "next/navigation";

/** Middleware přesměruje přihlášené uživatele na /admin nebo /employee. */
export default function Home() {
  redirect("/login");
}
