"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { LogOut, UserPlus, Calendar, TrendingUp } from "lucide-react"

type Profile = {
  id: string
  email: string
  full_name: string
  role: "agent" | "admin"
  is_active: boolean
}

type AgentStats = {
  id: string
  full_name: string
  email: string
  is_active: boolean
  core_minutes: number
  diverted_minutes: number
  total_minutes: number
  productivity: number
  utilization: number
}

type DailySummary = {
  date: string
  user_id: string
  full_name: string
  core_minutes: number
  diverted_minutes: number
  total_minutes: number
  productivity: number
  utilization: number
}

type TeamTrend = {
  date: string
  avg_productivity: number
  avg_utilization: number
  total_core_minutes: number
  total_diverted_minutes: number
  active_agents: number
}

export default function AdminDashboard({ profile }: { profile: Profile }) {
  const [agents, setAgents] = useState<AgentStats[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentStats | null>(null)
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserName, setNewUserName] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRole, setNewUserRole] = useState<"agent" | "admin">("agent")
  const [teamStats, setTeamStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    avgProductivity: 0,
    avgUtilization: 0,
    totalCoreMinutes: 0,
    totalDivertedMinutes: 0,
  })
  const [historicalData, setHistoricalData] = useState<DailySummary[]>([])
  const [teamTrends, setTeamTrends] = useState<TeamTrend[]>([])
  const [historyDays, setHistoryDays] = useState<number>(7)
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchTeamData()
    fetchHistoricalData()
  }, [])

  useEffect(() => {
    fetchHistoricalData()
  }, [historyDays, selectedAgentId])

  const fetchTeamData = async () => {
    const today = new Date().toISOString().split("T")[0]

    const { data: profiles } = await supabase.from("profiles").select("*").order("full_name")

    if (!profiles) return

    const agentStatsPromises = profiles.map(async (agent) => {
      const { data: taskLogs } = await supabase
        .from("task_logs")
        .select("time_spent")
        .eq("user_id", agent.id)
        .gte("completed_at", `${today}T00:00:00`)
        .lte("completed_at", `${today}T23:59:59`)

      const { data: divertedLogs } = await supabase
        .from("diverted_tasks")
        .select("time_spent")
        .eq("user_id", agent.id)
        .gte("completed_at", `${today}T00:00:00`)
        .lte("completed_at", `${today}T23:59:59`)

      const coreMinutes = taskLogs?.reduce((sum, log) => sum + log.time_spent, 0) || 0
      const divertedMinutes = divertedLogs?.reduce((sum, log) => sum + log.time_spent, 0) || 0
      const totalMinutes = coreMinutes + divertedMinutes
      const productivity = totalMinutes > 0 ? Math.round((coreMinutes / totalMinutes) * 100) : 0
      const utilization = Math.round((totalMinutes / 435) * 100)

      return {
        id: agent.id,
        full_name: agent.full_name,
        email: agent.email,
        is_active: agent.is_active,
        core_minutes: coreMinutes,
        diverted_minutes: divertedMinutes,
        total_minutes: totalMinutes,
        productivity,
        utilization,
      }
    })

    const agentStats = await Promise.all(agentStatsPromises)
    setAgents(agentStats)

    const activeAgents = agentStats.filter((a) => a.is_active)
    const totalCoreMinutes = agentStats.reduce((sum, a) => sum + a.core_minutes, 0)
    const totalDivertedMinutes = agentStats.reduce((sum, a) => sum + a.diverted_minutes, 0)
    const avgProductivity =
      activeAgents.length > 0
        ? Math.round(activeAgents.reduce((sum, a) => sum + a.productivity, 0) / activeAgents.length)
        : 0
    const avgUtilization =
      activeAgents.length > 0
        ? Math.round(activeAgents.reduce((sum, a) => sum + a.utilization, 0) / activeAgents.length)
        : 0

    setTeamStats({
      totalAgents: profiles.length,
      activeAgents: activeAgents.length,
      avgProductivity,
      avgUtilization,
      totalCoreMinutes,
      totalDivertedMinutes,
    })
  }

  const fetchHistoricalData = async () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - historyDays)

    let query = supabase
      .from("daily_summaries")
      .select(`
        *,
        profile:profiles(full_name)
      `)
      .gte("date", startDate.toISOString().split("T")[0])
      .lte("date", endDate.toISOString().split("T")[0])
      .order("date", { ascending: false })

    if (selectedAgentId) {
      query = query.eq("user_id", selectedAgentId)
    }

    const { data: summaries } = await query

    if (summaries) {
      const formattedSummaries = summaries.map((s: any) => ({
        date: s.date,
        user_id: s.user_id,
        full_name: s.profile.full_name,
        core_minutes: s.core_minutes,
        diverted_minutes: s.diverted_minutes,
        total_minutes: s.total_minutes,
        productivity: s.productivity_percentage,
        utilization: s.utilization_percentage,
      }))
      setHistoricalData(formattedSummaries)
    }

    const { data: allSummaries } = await supabase
      .from("daily_summaries")
      .select("*")
      .gte("date", startDate.toISOString().split("T")[0])
      .lte("date", endDate.toISOString().split("T")[0])
      .order("date", { ascending: false })

    if (allSummaries) {
      const trendsByDate = allSummaries.reduce((acc: any, summary: any) => {
        if (!acc[summary.date]) {
          acc[summary.date] = {
            date: summary.date,
            productivities: [],
            utilizations: [],
            core_minutes: 0,
            diverted_minutes: 0,
            agent_count: 0,
          }
        }
        acc[summary.date].productivities.push(summary.productivity_percentage)
        acc[summary.date].utilizations.push(summary.utilization_percentage)
        acc[summary.date].core_minutes += summary.core_minutes
        acc[summary.date].diverted_minutes += summary.diverted_minutes
        acc[summary.date].agent_count += 1
        return acc
      }, {})

      const trends = Object.values(trendsByDate).map((trend: any) => ({
        date: trend.date,
        avg_productivity: Math.round(
          trend.productivities.reduce((a: number, b: number) => a + b, 0) / trend.productivities.length,
        ),
        avg_utilization: Math.round(
          trend.utilizations.reduce((a: number, b: number) => a + b, 0) / trend.utilizations.length,
        ),
        total_core_minutes: trend.core_minutes,
        total_diverted_minutes: trend.diverted_minutes,
        active_agents: trend.agent_count,
      }))

      setTeamTrends(trends as TeamTrend[])
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
            role: newUserRole,
          },
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
        },
      })

      if (authError) throw authError

      setNewUserEmail("")
      setNewUserName("")
      setNewUserPassword("")
      setNewUserRole("agent")
      setIsCreateUserOpen(false)

      fetchTeamData()
    } catch (error) {
      console.error("Error creating user:", error)
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    await supabase.from("profiles").update({ is_active: !currentStatus }).eq("id", userId)
    fetchTeamData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Registration Validations Team</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new agent or admin to the system</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUserRole} onValueChange={(value: "agent" | "admin") => setNewUserRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    Create User
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamStats.activeAgents} / {teamStats.totalAgents}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Productivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.avgProductivity}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamStats.avgUtilization}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Time Today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamStats.totalCoreMinutes + teamStats.totalDivertedMinutes} min
              </div>
              <p className="text-xs text-muted-foreground">
                Core: {teamStats.totalCoreMinutes} | Diverted: {teamStats.totalDivertedMinutes}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Team Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Performance</CardTitle>
                <CardDescription>Real-time productivity metrics for all agents</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Core (min)</TableHead>
                      <TableHead className="text-right">Diverted (min)</TableHead>
                      <TableHead className="text-right">Total (min)</TableHead>
                      <TableHead className="text-right">Productivity</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.full_name}</TableCell>
                        <TableCell>
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{agent.core_minutes}</TableCell>
                        <TableCell className="text-right">{agent.diverted_minutes}</TableCell>
                        <TableCell className="text-right">{agent.total_minutes}</TableCell>
                        <TableCell className="text-right">{agent.productivity}%</TableCell>
                        <TableCell className="text-right">{agent.utilization}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage team members and their access</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.full_name}</TableCell>
                        <TableCell>{agent.email}</TableCell>
                        <TableCell>
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleUserStatus(agent.id, agent.is_active)}
                          >
                            {agent.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Performance Reports</CardTitle>
                      <CardDescription>Analyze team and individual performance trends</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={selectedAgentId || "all"}
                        onValueChange={(v) => setSelectedAgentId(v === "all" ? "" : v)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="All Agents" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Agents</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={historyDays.toString()} onValueChange={(v) => setHistoryDays(Number.parseInt(v))}>
                        <SelectTrigger className="w-[180px]">
                          <Calendar className="mr-2 h-4 w-4" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="14">Last 14 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {!selectedAgentId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Team Trends
                    </CardTitle>
                    <CardDescription>Daily team performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Active Agents</TableHead>
                          <TableHead className="text-right">Core (min)</TableHead>
                          <TableHead className="text-right">Diverted (min)</TableHead>
                          <TableHead className="text-right">Avg Productivity</TableHead>
                          <TableHead className="text-right">Avg Utilization</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTrends.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No data available for this period
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamTrends.map((trend) => (
                            <TableRow key={trend.date}>
                              <TableCell className="font-medium">{formatDate(trend.date)}</TableCell>
                              <TableCell className="text-right">{trend.active_agents}</TableCell>
                              <TableCell className="text-right">{trend.total_core_minutes}</TableCell>
                              <TableCell className="text-right">{trend.total_diverted_minutes}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={trend.avg_productivity >= 70 ? "default" : "secondary"}>
                                  {trend.avg_productivity}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={trend.avg_utilization >= 80 ? "default" : "secondary"}>
                                  {trend.avg_utilization}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{selectedAgentId ? "Individual Performance" : "All Agent Performance"}</CardTitle>
                  <CardDescription>
                    {selectedAgentId
                      ? "Detailed performance data for selected agent"
                      : "Performance data for all agents"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {!selectedAgentId && <TableHead>Agent</TableHead>}
                        <TableHead className="text-right">Core (min)</TableHead>
                        <TableHead className="text-right">Diverted (min)</TableHead>
                        <TableHead className="text-right">Total (min)</TableHead>
                        <TableHead className="text-right">Productivity</TableHead>
                        <TableHead className="text-right">Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicalData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={selectedAgentId ? 6 : 7} className="text-center text-muted-foreground">
                            No data available for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        historicalData.map((summary, idx) => (
                          <TableRow key={`${summary.user_id}-${summary.date}-${idx}`}>
                            <TableCell className="font-medium">{formatDate(summary.date)}</TableCell>
                            {!selectedAgentId && <TableCell>{summary.full_name}</TableCell>}
                            <TableCell className="text-right">{summary.core_minutes}</TableCell>
                            <TableCell className="text-right">{summary.diverted_minutes}</TableCell>
                            <TableCell className="text-right">{summary.total_minutes}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={summary.productivity >= 70 ? "default" : "secondary"}>
                                {summary.productivity}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={summary.utilization >= 80 ? "default" : "secondary"}>
                                {summary.utilization}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
