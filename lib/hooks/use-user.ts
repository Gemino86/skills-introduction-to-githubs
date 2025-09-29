"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export type UserProfile = {
  id: string
  email: string
  full_name: string
  role: "agent" | "admin"
  is_active: boolean
}

export function useUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()

        setProfile(data)
      }
      setLoading(false)
    }

    fetchProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchProfile()
    })

    return () => subscription.unsubscribe()
  }, [])

  return { profile, loading }
}
