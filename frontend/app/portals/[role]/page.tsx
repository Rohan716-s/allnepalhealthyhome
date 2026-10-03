import { redirect } from "next/navigation";

const destinations: Record<string, string> = { pharmacist: "/pharmacist", delivery: "/delivery", supervisor: "/supervisor" };

export default async function PortalPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  redirect(destinations[role] ?? "/auth");
}
