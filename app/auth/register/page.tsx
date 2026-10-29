import { redirect } from "next/navigation";

export default function Page() {
  redirect("/auth/login?message=Accounts are created by CUT HR or the system administrator.");
}
