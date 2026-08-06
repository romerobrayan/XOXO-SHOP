import { redirect } from "next/navigation";

import { PANEL_HOME } from "@/features/admin/paths";

// The panel has one job today: orders. Products and inventory land with the
// rest of Bloque D and this becomes a real dashboard then.
export default function AdminPage() {
  redirect(PANEL_HOME);
}
