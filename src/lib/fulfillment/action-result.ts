import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/validation";

export function result(error: { code?: string; message: string } | null, success: string): FormState {
  if (error) return { error: ["22023", "40001", "42501"].includes(error.code ?? "") ? error.message : error.code === "23P01" || error.code === "23505" ? "This slot or request changed. Reload and choose an available option." : "This change could not be saved. Check the details and retry; no success is confirmed." };
  for (const path of ["/professional", "/admin", "/account", "/services", "/professionals"]) revalidatePath(path, "layout");
  return { success };
}
