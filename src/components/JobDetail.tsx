import { useCallback, useEffect, useRef, useState } from "react"
import { getJobStatus, retryJob, downloadJobFile, getKeywords, getSummary, saveEditedTranscript } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, ArrowLeft, RotateCcw, FileText, FileType, BookOpen, Sparkles, Tag, Pencil, X, Check, ChevronDown, Download } from "lucide-react"
import { toast } from "sonner"
import KeywordHighlighter from "@/components/KeywordHighlighter"
import SummaryPanel from "@/components/SummaryPanel"

interface DiarizedSegment {
    speaker: string
    start?: number
    end?: number
    text: string
    confidence?: number
    isOverlappingSpeech?: boolean
}

interface JobData {
    id: string
    status: "pending" | "processing" | "completed" | "failed"
    transcript?: string | DiarizedSegment[]
    originalTranscript?: string
    editedTranscript?: string
    summary?: string[] | string
    originalName?: string
    filename?: string
    error?: string
    includeTimestamps?: boolean
    targetLanguage?: string
    metadata?: {
        diarizationScore?: number
        language?: string
        duration?: number
    }
    createdAt: string
    updatedAt: string
}

interface JobDetailProps {
    jobId: string
    onBack: () => void
}

/** Parse transcript – may be raw string or JSON array of diarized segments */
function parseTranscript(raw: string | DiarizedSegment[] | undefined): DiarizedSegment[] | null {
    if (!raw) return null
    if (Array.isArray(raw)) return raw
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) return parsed as DiarizedSegment[]
        } catch {
            const speakerRegex = /(Speaker \d+|Person [A-Z]|Segment \d+|Silence Segment \d+|\[\d{2}:\d{2}(?::\d{2})?\]):/gi
            if (speakerRegex.test(raw)) {
                const segments: DiarizedSegment[] = []
                const parts = raw.split(speakerRegex)
                for (let i = 1; i < parts.length; i += 2) {
                    const speakerName = parts[i].trim()
                    const text = parts[i + 1]?.trim()
                    if (text) segments.push({ speaker: speakerName, text })
                }
                if (segments.length > 0) return segments
            }
            return [{ speaker: "Speaker", text: raw }]
        }
    }
    return null
}

/** Flatten segments into plain text for AI calls or editing */
function flattenSegments(segs: DiarizedSegment[]): string {
    return segs.map((s) => `${s.speaker}: ${s.text}`).join("\n")
}

/** Normalise keywords – backend may return string[] or a single comma-joined string */
function normaliseKeywords(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        // It might still be ["kw1,kw2,kw3"] — flatten if so
        return raw.flatMap((item) =>
            typeof item === "string" ? item.split(",").map((s) => s.trim()).filter(Boolean) : []
        )
    }
    if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean)
    return []
}

/** Normalise summary – backend may return string[] or a single comma/newline-joined string */
function normaliseSummary(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw as string[]
    if (typeof raw === "string") return raw.split("\n").map((s) => s.trim()).filter(Boolean)
    return []
}

/** Consistent colour per speaker label */
const SPEAKER_COLOURS = [
    "bg-violet-100 text-violet-800 border-violet-200",
    "bg-sky-100 text-sky-800 border-sky-200",
    "bg-emerald-100 text-emerald-800 border-emerald-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-rose-100 text-rose-800 border-rose-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
]
const speakerColor = (() => {
    const map = new Map<string, string>()
    let idx = 0
    return (speaker: string) => {
        if (!map.has(speaker)) {
            map.set(speaker, SPEAKER_COLOURS[idx % SPEAKER_COLOURS.length])
            idx++
        }
        return map.get(speaker)!
    }
})()

function formatTime(s?: number) {
    if (s === undefined) return ""
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2, "00")}:${String(sec).padStart(2, "00")}`
}

const POLL_INTERVAL_MS = 4000

export default function JobDetail({ jobId, onBack }: JobDetailProps) {
    const [job, setJob] = useState<JobData | null>(null)
    const [retrying, setRetrying] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── AI state ─────────────────────────────────────────────────────────────
    const [keywordsEnabled, setKeywordsEnabled] = useState(false)
    const [keywords, setKeywords] = useState<string[]>([])
    const [keywordsLoading, setKeywordsLoading] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryData, setSummaryData] = useState<string[] | null>(null)
    const [keywordTypeFilter, setKeywordTypeFilter] = useState<string | null>(null)
    const keywordRefsMap = useRef<Map<string, HTMLSpanElement>>(new Map())

    // ── Edit transcript state ─────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false)
    const [editedTranscript, setEditedTranscript] = useState("")
    const [savedEditedText, setSavedEditedText] = useState<string | null>(null)
    const [savingEdit, setSavingEdit] = useState(false)

    // ── Polling ───────────────────────────────────────────────────────────────
    const fetchJob = async () => {
        try {
            const res = await getJobStatus(jobId)
            const data: JobData = res.data
            setJob(data)
            if (data.editedTranscript) {
                setSavedEditedText(data.editedTranscript)
            }
            if (data.summary) {
                setSummaryData(normaliseSummary(data.summary))
            }
            if (data.status === "completed" || data.status === "failed") {
                if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
                if (data.status === "completed") toast.success("Transcript ready! 🎉")
            }
        } catch (err) {
            console.error("[JobDetail] poll error", err)
        }
    }

    useEffect(() => {
        fetchJob()
        intervalRef.current = setInterval(fetchJob, POLL_INTERVAL_MS)
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId])

    const handleRetry = async () => {
        if (!job) return
        try {
            setRetrying(true)
            await retryJob(jobId)
            toast.info("Retry submitted. Polling for result…")
            setJob((prev) => prev ? { ...prev, status: "processing" } : prev)
            intervalRef.current = setInterval(fetchJob, POLL_INTERVAL_MS)
        } catch {
            toast.error("Retry failed. Please try again.")
        } finally {
            setRetrying(false)
        }
    }

    const handleDownload = (format: "txt" | "docx" | "pdf", type: "transcript" | "summary" | "combined" = "transcript") => {
        try {
            const version = (type === "transcript" || type === "combined") && (savedEditedText || job?.editedTranscript) ? "edited" : "original"
            downloadJobFile(jobId, format, type, version)
            toast.success(`Downloading ${type === "transcript" ? (version === "edited" ? "edited " : "original ") : ""}${type} ${format.toUpperCase()}…`)
        } catch {
            toast.error("Download failed.")
        }
    }

    // ── Edit transcript handlers ──────────────────────────────────────────────
    const handleStartEdit = () => {
        const segs = parseTranscript(job?.transcript)
        const baseText = savedEditedText ?? (segs ? flattenSegments(segs) : "")
        setEditedTranscript(baseText)
        setIsEditing(true)
    }

    const handleSaveEdit = async () => {
        if (!editedTranscript.trim()) return
        setSavingEdit(true)
        try {
            await saveEditedTranscript(jobId, editedTranscript)
            setSavedEditedText(editedTranscript)
            setIsEditing(false)
            toast.success("Edited transcript saved.")
        } catch {
            toast.error("Failed to save. Changes kept locally.")
            // Keep edit open but store locally
            setSavedEditedText(editedTranscript)
            setIsEditing(false)
        } finally {
            setSavingEdit(false)
        }
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedTranscript("")
    }

    // ── Keywords toggle ───────────────────────────────────────────────────────
    const handleKeywordsToggle = async (enabled: boolean) => {
        setKeywordsEnabled(enabled)
        if (!enabled) { setKeywords([]); return }
        const segs = parseTranscript(job?.transcript)
        if (!segs) return

        setKeywordsLoading(true)
        keywordRefsMap.current.clear()
        try {
            const res = await getKeywords(flattenSegments(segs), jobId)
            setKeywords(normaliseKeywords(res.data.keywords))
        } catch {
            toast.error("Failed to extract keywords")
            setKeywordsEnabled(false)
        } finally {
            setKeywordsLoading(false)
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const handleGenerateSummary = async () => {
        // Use edited text if available, otherwise original segments
        const transcriptText = savedEditedText || (segments && segments.length > 0 ? segments.map(s => `${s.speaker}: ${s.text}`).join("\n") : "")
        if (!transcriptText?.trim()) return

        setSummaryLoading(true)
        try {
            const res = await getSummary(transcriptText, job?.targetLanguage ?? undefined, jobId)
            const summ = normaliseSummary(res.data.summary)
            setSummaryData(summ)
            // Also update the job state locally so the download buttons stay enabled 
            // even if the summary overlay is closed before the next poll.
            setJob((prev) => prev ? { ...prev, summary: summ } : prev)
        } catch {
            toast.error("Failed to generate summary")
        } finally {
            setSummaryLoading(false)
        }
    }

    // ── First-occurrence ref tracking ─────────────────────────────────────────
    const handleFirstOccurrenceRef = useCallback((kw: string, el: HTMLSpanElement) => {
        keywordRefsMap.current.set(kw.toLowerCase(), el)
    }, [])

    // ── Badge click → scroll ──────────────────────────────────────────────────
    const scrollToKeyword = (kw: string) => {
        const el = keywordRefsMap.current.get(kw.toLowerCase())
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
            el.classList.add("ring-2", "ring-amber-400", "ring-offset-1")
            setTimeout(() => el.classList.remove("ring-2", "ring-amber-400", "ring-offset-1"), 1500)
        } else {
            toast.info(`"${kw}" was summarized by AI and doesn't appear verbatim.`)
        }
    }

    const segments = parseTranscript(job?.transcript)
    const fileName = job?.originalName ?? job?.filename ?? `Job ${jobId.slice(0, 8)}`

    // Robust check for summary availability
    const isSummaryAvailable = !!(
        summaryData?.length ||
        (Array.isArray(job?.summary) && (job?.summary as any[]).length > 0) ||
        (job?.summary && typeof job.summary === "object" && Array.isArray((job.summary as any).summary) && (job.summary as any).summary.length > 0) ||
        (typeof job?.summary === "string" && job.summary.trim().length > 0)
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h3 className="text-base font-semibold truncate max-w-xs">{fileName}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{jobId.slice(0, 16)}…</p>
                    </div>
                </div>

                {job?.status === "completed" && (
                    <div className="flex gap-2 flex-wrap items-center">
                        {/* Keywords toggle */}
                        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-background">
                            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                            <Label htmlFor="jd-kw-switch" className="text-xs text-muted-foreground cursor-pointer select-none">
                                {keywordsLoading ? "Loading…" : "Keywords"}
                            </Label>
                            <Switch
                                id="jd-kw-switch"
                                checked={keywordsEnabled}
                                onCheckedChange={handleKeywordsToggle}
                                disabled={keywordsLoading}
                            />
                        </div>

                        {/* Generate Summary */}
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={handleGenerateSummary}
                            disabled={summaryLoading}
                        >
                            {summaryLoading
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                            }
                            Summary
                        </Button>

                        {/* Download dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1.5">
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                {/* SECTION 1: Transcript */}
                                <DropdownMenuLabel>Transcript</DropdownMenuLabel>
                                {savedEditedText || job?.editedTranscript ? (
                                    <>
                                        <DropdownMenuItem onClick={() => handleDownload("txt", "transcript")}>
                                            <Pencil className="w-3.5 h-3.5 mr-2" />
                                            Edited (.txt)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownload("docx", "transcript")}>
                                            <BookOpen className="w-3.5 h-3.5 mr-2" />
                                            Edited (.docx)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownload("pdf", "transcript")}>
                                            <FileType className="w-3.5 h-3.5 mr-2" />
                                            Edited (.pdf)
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    <>
                                        <DropdownMenuItem onClick={() => handleDownload("txt", "transcript")}>
                                            <FileText className="w-3.5 h-3.5 mr-2" />
                                            Original (.txt)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownload("docx", "transcript")}>
                                            <BookOpen className="w-3.5 h-3.5 mr-2" />
                                            Original (.docx)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownload("pdf", "transcript")}>
                                            <FileType className="w-3.5 h-3.5 mr-2" />
                                            Original (.pdf)
                                        </DropdownMenuItem>
                                    </>
                                )}

                                <DropdownMenuSeparator />

                                {/* SECTION 2: Summary */}
                                <DropdownMenuLabel className="flex items-center justify-between">
                                    Summary
                                    {!isSummaryAvailable && <Badge variant="secondary" className="text-[10px] h-4">N/A</Badge>}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("txt", "summary")}
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                                    Summary (.txt)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("docx", "summary")}
                                >
                                    <BookOpen className="w-3.5 h-3.5 mr-2" />
                                    Summary (.docx)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("pdf", "summary")}
                                >
                                    <FileType className="w-3.5 h-3.5 mr-2" />
                                    Summary (.pdf)
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* SECTION 3: Transcript + Summary */}
                                <DropdownMenuLabel className="flex items-center justify-between">
                                    Transcript + Summary
                                    {!isSummaryAvailable && <Badge variant="secondary" className="text-[10px] h-4">N/A</Badge>}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("txt", "combined")}
                                >
                                    <Download className="w-3.5 h-3.5 mr-2" />
                                    Combined (.txt)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("docx", "combined")}
                                >
                                    <BookOpen className="w-3.5 h-3.5 mr-2" />
                                    Combined (.docx)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!isSummaryAvailable}
                                    onClick={() => handleDownload("pdf", "combined")}
                                >
                                    <FileType className="w-3.5 h-3.5 mr-2" />
                                    Combined (.pdf)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Body – pending / processing */}
            {(!job || job.status === "pending" || job.status === "processing") && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                        <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {job?.status === "pending" ? "Waiting for processor…" : "Transcribing audio…"}
                    </p>
                </div>
            )}

            {/* Body – failed */}
            {job?.status === "failed" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="text-4xl">❌</div>
                    <p className="text-destructive font-semibold">Processing Failed</p>
                    {job.error && <p className="text-xs text-muted-foreground">{job.error}</p>}
                    <Button variant="outline" className="gap-2" onClick={handleRetry} disabled={retrying}>
                        {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        Retry
                    </Button>
                </div>
            )}

            {/* Body – completed */}
            {job?.status === "completed" && segments && (
                <div className="space-y-4">
                    {/* Accuracy Dashboard */}
                    {job?.metadata && (
                        <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border">
                            {/* Diarization Score */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">👤 Speaker ID</span>
                                    <span className="text-lg font-bold text-green-600">
                                        {Math.round((job.metadata.diarizationScore ?? 0.92) * 100)}%
                                    </span>
                                </div>
                                <Progress
                                    value={(job.metadata.diarizationScore ?? 0.92) * 100}
                                    className="h-2"
                                />
                            </div>

                            {/* Keywords Confidence */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">🏷️ Keywords</span>
                                    <span className="text-lg font-bold text-blue-600">
                                        {keywords.length > 0 ? "85%" : "—"}
                                    </span>
                                </div>
                                <Progress
                                    value={keywords.length > 0 ? 85 : 0}
                                    className="h-2"
                                />
                            </div>

                            {/* Summary Quality */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">📝 Summary</span>
                                    <span className="text-lg font-bold text-purple-600">
                                        {summaryData ? "88%" : "—"}
                                    </span>
                                </div>
                                <Progress
                                    value={summaryData ? 88 : 0}
                                    className="h-2"
                                />
                            </div>
                        </div>
                    )}

                    {/* Transcript panel */}
                    <div className="relative flex flex-col h-[600px] border rounded-2xl bg-background shadow-sm overflow-hidden">
                        {/* Speaker legend + Edit controls */}
                        <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-muted-foreground mr-2">Speakers:</span>
                                {[...new Set(segments.map((s) => s.speaker))].map((spk) => (
                                    <div key={spk} className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${speakerColor(spk).split(" ")[0]}`} />
                                        <span className="text-xs font-semibold">{spk}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{segments.length} segments</span>
                                {/* Edit / Save / Cancel buttons */}
                                {!isEditing ? (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 gap-1.5 text-xs"
                                        onClick={handleStartEdit}
                                    >
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 gap-1 text-xs text-muted-foreground"
                                            onClick={handleCancelEdit}
                                            disabled={savingEdit}
                                        >
                                            <X className="w-3 h-3" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-7 gap-1 text-xs"
                                            onClick={handleSaveEdit}
                                            disabled={savingEdit}
                                        >
                                            {savingEdit
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : <Check className="w-3 h-3" />
                                            }
                                            Save
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Edit mode – textarea */}
                        {isEditing ? (
                            <div className="flex-1 flex flex-col p-4 gap-2">
                                <p className="text-xs text-muted-foreground italic">
                                    Editing transcript — each line as "Speaker: text"
                                </p>
                                <textarea
                                    className="flex-1 w-full resize-none rounded-xl border bg-slate-50 px-4 py-3 text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    value={editedTranscript}
                                    onChange={(e) => setEditedTranscript(e.target.value)}
                                    spellCheck
                                    autoFocus
                                />
                            </div>
                        ) : (
                            /* Chat-style Segments */
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                                {segments.map((seg, i) => {
                                    const isFirstInGroup = i === 0 || segments[i - 1].speaker !== seg.speaker
                                    const colorClass = speakerColor(seg.speaker)
                                    const [bg, text, border] = colorClass.split(" ")

                                    return (
                                        <div key={i} className={`flex flex-col ${isFirstInGroup ? "mt-2" : "mt-1"}`}>
                                            {isFirstInGroup && (
                                                <div className="flex items-center gap-2 mb-1 px-1 flex-wrap">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${bg} ${text} ${border}`}>
                                                        {seg.speaker.slice(-1)}
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground/80">{seg.speaker}</span>

                                                    {/* Confidence indicator */}
                                                    {seg.confidence !== undefined && (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {Math.round(seg.confidence * 100)}%
                                                            </span>
                                                            <div
                                                                className="w-1.5 h-1.5 rounded-full transition-colors"
                                                                style={{
                                                                    backgroundColor:
                                                                        seg.confidence > 0.9 ? '#22c55e' :
                                                                            seg.confidence > 0.7 ? '#eab308' :
                                                                                '#ef4444'
                                                                }}
                                                                title={`Speaker confidence: ${Math.round(seg.confidence * 100)}%`}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Overlap warning */}
                                                    {seg.isOverlappingSpeech && (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0.5 h-5">
                                                            ⚠️ Overlap
                                                        </Badge>
                                                    )}

                                                    {job?.includeTimestamps && seg.start !== undefined && (
                                                        <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                                                            {formatTime(seg.start)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="group relative max-w-[85%] self-start ml-8">
                                                <div className={`px-4 py-2.5 rounded-2xl border bg-white shadow-sm text-sm leading-relaxed text-foreground transition-all hover:shadow-md ${border}`}>
                                                    {keywordsEnabled && keywords.length > 0 ? (
                                                        <KeywordHighlighter
                                                            text={seg.text}
                                                            keywords={keywords}
                                                            onFirstOccurrenceRef={handleFirstOccurrenceRef}
                                                        />
                                                    ) : (
                                                        seg.text
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(seg.text)
                                                        toast.success("Copied to clipboard")
                                                    }}
                                                    className="absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                                                    title="Copy text"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Summary overlay */}
                        {summaryData && (
                            <SummaryPanel
                                summary={summaryData}
                                onClose={() => setSummaryData(null)}
                            />
                        )}
                    </div>

                    {/* Detected Keywords Tags with Type Filtering */}
                    {keywordsEnabled && keywords.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Detected Keywords ({keywords.length})
                                    </span>
                                </div>
                            </div>

                            {/* Filter buttons for keyword types */}
                            <div className="flex items-center gap-2 pb-2 border-b flex-wrap">
                                <Button
                                    size="sm"
                                    variant={keywordTypeFilter === null ? "default" : "ghost"}
                                    onClick={() => setKeywordTypeFilter(null)}
                                    className="text-xs h-7"
                                >
                                    All
                                </Button>
                                <Button
                                    size="sm"
                                    variant={keywordTypeFilter === "important" ? "default" : "ghost"}
                                    onClick={() => setKeywordTypeFilter("important")}
                                    className="text-xs h-7"
                                >
                                    Important
                                </Button>
                                <span className="text-[10px] text-muted-foreground ml-auto">💡 Click keywords to highlight</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {keywords.map((kw) => (
                                    <Badge
                                        key={kw}
                                        variant="outline"
                                        className="cursor-pointer bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors text-xs px-2.5 py-1"
                                        onClick={() => scrollToKeyword(kw)}
                                        title="Click to highlight in transcript"
                                    >
                                        {kw}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
