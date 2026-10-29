import { redirect } from "next/navigation";

export default function Page() {
  redirect(
    "/auth/login?message=Accounts are created by an administrator. Ask your administrator for an invitation.",
  );
}
