import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AgentDashboard from "@/components/agent-dashboard"
import AdminDashboard from "@/components/admin-dashboard"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile) {
    redirect("/auth/login")
  }

  // Route to appropriate dashboard based on role
  if (profile.role === "admin") {
    return <AdminDashboard profile={profile} />
  }

  return <AgentDashboard profile={profile} />
}
