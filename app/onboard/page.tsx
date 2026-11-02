import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "/auth/login?message=Account setup is managed by HR or an Administrator. Contact them if your account needs updating.",
  );
}
