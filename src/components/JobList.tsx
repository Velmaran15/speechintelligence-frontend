import { useEffect, useRef, useState } from "react"
import { getBatchStatus } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronRight, RefreshCw } from "lucide-react"

export interface Job {
    id: string
    status: "pending" | "processing" | "completed" | "failed"
    filename?: string
    originalName?: string
}

interface JobListProps {
    batchId: string
    onSelectJob: (jobId: string) => void
}

const POLL_INTERVAL_MS = 4000

function statusBadge(status: Job["status"]) {
    const map = {
        pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
        processing: { label: "Processing", className: "bg-blue-100 text-blue-700 border-blue-300" },
        completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-300" },
        failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-300" },
    }
    const cfg = map[status] ?? { label: status, className: "" }
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
            {status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {cfg.label}
        </span>
    )
}

export default function JobList({ batchId, onSelectJob }: JobListProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [fetching, setFetching] = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchBatch = async () => {
        try {
            const res = await getBatchStatus(batchId)
            // Backend returns { id, jobs: [...] } or similar shape
            const rawJobs: Job[] = res.data.jobs ?? []
            setJobs(rawJobs)

            const allDone = rawJobs.every(
                (j) => j.status === "completed" || j.status === "failed"
            )
            if (allDone && intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        } catch {
            // keep polling, transient error
        } finally {
            setFetching(false)
        }
    }

    useEffect(() => {
        fetchBatch()
        intervalRef.current = setInterval(fetchBatch, POLL_INTERVAL_MS)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchId])

    const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length
    const doneCount = jobs.filter((j) => j.status === "completed").length
    const failedCount = jobs.filter((j) => j.status === "failed").length

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-semibold">Batch Jobs</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Batch&nbsp;<code className="font-mono">{batchId.slice(0, 8)}…</code></p>
                </div>
                <div className="flex items-center gap-2">
                    {activeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Polling…
                        </span>
                    )}
                    <button
                        onClick={fetchBatch}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Refresh now"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats pills */}
            <div className="flex gap-3 flex-wrap text-sm">
                <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">{jobs.length} total</span>
                {doneCount > 0 && <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">{doneCount} done</span>}
                {failedCount > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">{failedCount} failed</span>}
                {activeCount > 0 && <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">{activeCount} in progress</span>}
            </div>

            {/* Job rows */}
            {fetching && jobs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-2">
                    {jobs.map((job, i) => (
                        <div
                            key={job.id}
                            className="flex items-center justify-between bg-muted/40 hover:bg-muted/60 transition-colors rounded-xl px-4 py-3 group"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <span className="text-muted-foreground text-sm font-mono shrink-0">#{String(i + 1).padStart(2, "0")}</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate max-w-xs">
                                        {job.originalName ?? job.filename ?? `Job ${job.id.slice(0, 8)}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono">{job.id.slice(0, 16)}…</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                {statusBadge(job.status)}
                                {job.status === "completed" && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs gap-1 group-hover:bg-primary/10"
                                        onClick={() => onSelectJob(job.id)}
                                    >
                                        View <ChevronRight className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
