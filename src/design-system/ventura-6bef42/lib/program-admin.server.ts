// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function assertAdminUser(supabase: SB, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}
