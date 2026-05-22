import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { defaultDashboardFor } from "@/lib/permissions";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(defaultDashboardFor(session.user.role));
  }
  redirect("/login");
}
