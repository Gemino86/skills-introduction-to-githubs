"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Coffee, PlayCircle, StopCircle, LogOut, Calendar } from "lucide-react"

type Profile = {
  id: string
  email: string
  full_name: string
  role: "agent" | "admin"
  is_active: boolean
}

type CoreTask = {
  id: string
  name: string
  allocated_time: number
  category: string
}

type WorkStatus = "idle" | "working" | "on_break"

type DailySummary = {
  date: string
  core_minutes: number
  diverted_minutes: number
  total_minutes: number
  productivity: number
  utilization: number
}

type TaskLog = {
  id: string
  completed_at: string
  time_spent: number
  notes: string | null
  core_task: {
    name: string
    category: string
  }
}

type DivertedLog = {
  id: string
  completed_at: string
  time_spent: number
  task_type: string
  description: string | null
}

export default function AgentDashboard({ profile }: { profile: Profile }) {
  const [workStatus, setWorkStatus] = useState<WorkStatus>("idle")
  const [coreTasks, setCoreTasks] = useState<CoreTask[]>([])
  const [selectedTask, setSelectedTask] = useState<string>("")
  const [taskTime, setTaskTime] = useState<string>("")
  const [taskNotes, setTaskNotes] = useState<string>("")
  const [divertedType, setDivertedType] = useState<string>("")
  const [divertedTime, setDivertedTime] = useState<string>("")
  const [divertedDesc, setDivertedDesc] = useState<string>("")
  const [todayStats, setTodayStats] = useState({
    coreMinutes: 0,
    divertedMinutes: 0,
    breakMinutes: 0,
  })
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [recentTaskLogs, setRecentTaskLogs] = useState<TaskLog[]>([])
  const [recentDivertedLogs, setRecentDivertedLogs] = useState<DivertedLog[]>([])
  const [historyDays, setHistoryDays] = useState<number>(7)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchCoreTasks()
    fetchTodayStats()
    checkCurrentStatus()
    fetchHistoricalData()
  }, [])

  useEffect(() => {
    fetchHistoricalData()
  }, [historyDays])

  const fetchCoreTasks = async () => {
    const { data } = await supabase.from("core_tasks").select("*").order("name")
    if (data) setCoreTasks(data)
  }

  const fetchTodayStats = async () => {
    const today = new Date().toISOString().split("T")[0]

    const { data: taskLogs } = await supabase
      .from("task_logs")
      .select("time_spent")
      .eq("user_id", profile.id)
      .gte("completed_at", `${today}T00:00:00`)
      .lte("completed_at", `${today}T23:59:59`)

    const { data: divertedLogs } = await supabase
      .from("diverted_tasks")
      .select("time_spent")
      .eq("user_id", profile.id)
      .gte("completed_at", `${today}T00:00:00`)
      .lte("completed_at", `${today}T23:59:59`)

    const coreMinutes = taskLogs?.reduce((sum, log) => sum + log.time_spent, 0) || 0
    const divertedMinutes = divertedLogs?.reduce((sum, log) => sum + log.time_spent, 0) || 0

    setTodayStats({
      coreMinutes,
      divertedMinutes,
      breakMinutes: 0,
    })
  }

  const fetchHistoricalData = async () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - historyDays)

    const { data: summaries } = await supabase
      .from("daily_summaries")
      .select("*")
      .eq("user_id", profile.id)
      .gte("date", startDate.toISOString().split("T")[0])
      .lte("date", endDate.toISOString().split("T")[0])
      .order("date", { ascending: false })

    if (summaries) {
      const formattedSummaries = summaries.map((s) => ({
        date: s.date,
        core_minutes: s.core_minutes,
        diverted_minutes: s.diverted_minutes,
        total_minutes: s.total_minutes,
        productivity: s.productivity_percentage,
        utilization: s.utilization_percentage,
      }))
      setDailySummaries(formattedSummaries)
    }

    const { data: tasks } = await supabase
      .from("task_logs")
      .select(`
        id,
        completed_at,
        time_spent,
        notes,
        core_task:core_tasks(name, category)
      `)
      .eq("user_id", profile.id)
      .gte("completed_at", startDate.toISOString())
      .order("completed_at", { ascending: false })
      .limit(20)

    if (tasks) {
      setRecentTaskLogs(tasks as unknown as TaskLog[])
    }

    const { data: diverted } = await supabase
      .from("diverted_tasks")
      .select("*")
      .eq("user_id", profile.id)
      .gte("completed_at", startDate.toISOString())
      .order("completed_at", { ascending: false })
      .limit(20)

    if (diverted) {
      setRecentDivertedLogs(diverted)
    }
  }

  const checkCurrentStatus = async () => {
    const { data } = await supabase
      .from("time_logs")
      .select("*")
      .eq("user_id", profile.id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single()

    if (data) {
      if (data.log_type === "work_start") setWorkStatus("working")
      else if (data.log_type === "break_start") setWorkStatus("on_break")
      else setWorkStatus("idle")
    }
  }

  const handleWorkStart = async () => {
    await supabase.from("time_logs").insert({
      user_id: profile.id,
      log_type: "work_start",
    })
    setWorkStatus("working")
  }

  const handleWorkEnd = async () => {
    await supabase.from("time_logs").insert({
      user_id: profile.id,
      log_type: "work_end",
    })
    setWorkStatus("idle")
  }

  const handleBreakStart = async () => {
    await supabase.from("time_logs").insert({
      user_id: profile.id,
      log_type: "break_start",
    })
    setWorkStatus("on_break")
  }

  const handleBreakEnd = async () => {
    await supabase.from("time_logs").insert({
      user_id: profile.id,
      log_type: "break_end",
    })
    setWorkStatus("working")
  }

  const handleLogCoreTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask || !taskTime) return

    await supabase.from("task_logs").insert({
      user_id: profile.id,
      core_task_id: selectedTask,
      time_spent: Number.parseInt(taskTime),
      notes: taskNotes || null,
    })

    setSelectedTask("")
    setTaskTime("")
    setTaskNotes("")
    fetchTodayStats()
    fetchHistoricalData()
  }

  const handleLogDivertedTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!divertedType || !divertedTime) return

    await supabase.from("diverted_tasks").insert({
      user_id: profile.id,
      task_type: divertedType,
      time_spent: Number.parseInt(divertedTime),
      description: divertedDesc || null,
    })

    setDivertedType("")
    setDivertedTime("")
    setDivertedDesc("")
    fetchTodayStats()
    fetchHistoricalData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const totalMinutes = todayStats.coreMinutes + todayStats.divertedMinutes
  const targetMinutes = 435
  const productivity = totalMinutes > 0 ? Math.round((todayStats.coreMinutes / totalMinutes) * 100) : 0
  const utilization = Math.round((totalMinutes / targetMinutes) * 100)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agent Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {profile.full_name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge
                variant={workStatus === "working" ? "default" : workStatus === "on_break" ? "secondary" : "outline"}
                className="text-lg px-4 py-2"
              >
                {workStatus === "working" ? "Working" : workStatus === "on_break" ? "On Break" : "Idle"}
              </Badge>
              <div className="flex gap-2">
                {workStatus === "idle" && (
                  <Button onClick={handleWorkStart}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start Work
                  </Button>
                )}
                {workStatus === "working" && (
                  <>
                    <Button onClick={handleWorkEnd} variant="destructive">
                      <StopCircle className="mr-2 h-4 w-4" />
                      End Work
                    </Button>
                    <Button onClick={handleBreakStart} variant="secondary">
                      <Coffee className="mr-2 h-4 w-4" />
                      Start Break
                    </Button>
                  </>
                )}
                {workStatus === "on_break" && (
                  <Button onClick={handleBreakEnd}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    End Break
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Core Tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.coreMinutes} min</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Diverted Tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayStats.divertedMinutes} min</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Productivity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{productivity}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{utilization}%</div>
              <p className="text-xs text-muted-foreground">
                {totalMinutes} / {targetMinutes} min
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="core" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="core">Log Core Task</TabsTrigger>
            <TabsTrigger value="diverted">Log Diverted Task</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="core">
            <Card>
              <CardHeader>
                <CardTitle>Log Core Task</CardTitle>
                <CardDescription>Record time spent on core tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogCoreTask} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="task">Task</Label>
                    <Select value={selectedTask} onValueChange={setSelectedTask} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a task" />
                      </SelectTrigger>
                      <SelectContent>
                        {coreTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.name} ({task.allocated_time} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">Time Spent (minutes)</Label>
                    <Input
                      id="time"
                      type="number"
                      min="1"
                      placeholder="15"
                      value={taskTime}
                      onChange={(e) => setTaskTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional details..."
                      value={taskNotes}
                      onChange={(e) => setTaskNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Log Task
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diverted">
            <Card>
              <CardHeader>
                <CardTitle>Log Diverted Task</CardTitle>
                <CardDescription>Record time spent on non-core activities</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogDivertedTask} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="diverted-type">Task Type</Label>
                    <Select value={divertedType} onValueChange={setDivertedType} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Coaching">Coaching</SelectItem>
                        <SelectItem value="Training">Training</SelectItem>
                        <SelectItem value="Compliance Training">Compliance Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="diverted-time">Time Spent (minutes)</Label>
                    <Input
                      id="diverted-time"
                      type="number"
                      min="1"
                      placeholder="30"
                      value={divertedTime}
                      onChange={(e) => setDivertedTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="diverted-desc">Description (optional)</Label>
                    <Textarea
                      id="diverted-desc"
                      placeholder="What was this about..."
                      value={divertedDesc}
                      onChange={(e) => setDivertedDesc(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Log Task
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Performance History</CardTitle>
                      <CardDescription>View your productivity trends over time</CardDescription>
                    </div>
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
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Core (min)</TableHead>
                        <TableHead className="text-right">Diverted (min)</TableHead>
                        <TableHead className="text-right">Total (min)</TableHead>
                        <TableHead className="text-right">Productivity</TableHead>
                        <TableHead className="text-right">Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySummaries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No data available for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailySummaries.map((summary) => (
                          <TableRow key={summary.date}>
                            <TableCell className="font-medium">{formatDate(summary.date)}</TableCell>
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

              <Card>
                <CardHeader>
                  <CardTitle>Recent Core Tasks</CardTitle>
                  <CardDescription>Your latest completed core tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Time (min)</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTaskLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No core tasks logged yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentTaskLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {formatDate(log.completed_at)} {formatTime(log.completed_at)}
                            </TableCell>
                            <TableCell>{log.core_task.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.core_task.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{log.time_spent}</TableCell>
                            <TableCell className="text-muted-foreground">{log.notes || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Diverted Tasks</CardTitle>
                  <CardDescription>Your latest non-core activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Time (min)</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDivertedLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No diverted tasks logged yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentDivertedLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {formatDate(log.completed_at)} {formatTime(log.completed_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{log.task_type}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{log.time_spent}</TableCell>
                            <TableCell className="text-muted-foreground">{log.description || "-"}</TableCell>
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
