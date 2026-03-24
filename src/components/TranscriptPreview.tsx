import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, Loader2, RotateCcw, Sparkles, Tag, Pencil, X, Check, ChevronDown, FileText, BookOpen, FileType } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { getKeywords, getSummary } from "@/api/api"
import KeywordHighlighter from "@/components/KeywordHighlighter"
import SummaryPanel from "@/components/SummaryPanel"

interface DiarizedSegment {
    speaker: string
    start?: number
    end?: number
    text: string
}

interface TranscriptPreviewProps {
    transcript: string | DiarizedSegment[]
    onDownload: (format: "docx" | "pdf", useEdited?: boolean) => void
    onReset: () => void
    showTimestamps?: boolean
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
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

/** Flatten segments into a single plain-text string for AI calls */
function flattenTranscript(segments: DiarizedSegment[]): string {
    return segments.map((s) => `${s.speaker}: ${s.text}`).join("\n")
}

/** Normalise keywords – backend may return string[] or a single comma-joined string */
function normaliseKeywords(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw.flatMap((item) =>
            typeof item === "string" ? item.split(",").map((s) => s.trim()).filter(Boolean) : []
        )
    }
    if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean)
    return []
}

/** Normalise summary – backend may return string[] or a newline-joined string */
function normaliseSummary(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw as string[]
    if (typeof raw === "string") return raw.split("\n").map((s) => s.trim()).filter(Boolean)
    return []
}

/** Download text as a .txt file (client-side blob) */
function downloadAsText(text: string, label: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Transcript_${label}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export default function TranscriptPreview({
    transcript,
    onDownload,
    onReset,
    showTimestamps = false,
}: TranscriptPreviewProps) {

    const [keywordsEnabled, setKeywordsEnabled] = useState(false)
    const [keywords, setKeywords] = useState<string[]>([])
    const [keywordsLoading, setKeywordsLoading] = useState(false)

    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryData, setSummaryData] = useState<string[] | null>(null)

    // ── Edit transcript state ─────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false)
    const [editedTranscript, setEditedTranscript] = useState("")
    const [savedEditedText, setSavedEditedText] = useState<string | null>(null)

    // Map from keyword (lowercase) → first DOM element
    const keywordRefsMap = useRef<Map<string, HTMLSpanElement>>(new Map())

    const segments: DiarizedSegment[] | null = (() => {
        if (!transcript) return null
        if (Array.isArray(transcript)) return transcript

        try {
            const parsed = JSON.parse(transcript)
            if (Array.isArray(parsed)) return parsed
        } catch {
            const speakerRegex = /(Speaker \d+|Person [A-Z]|Segment \d+|Silence Segment \d+|\[\d{2}:\d{2}(?::\d{2})?\]):/gi
            if (speakerRegex.test(transcript)) {
                const segs: DiarizedSegment[] = []
                const parts = transcript.split(speakerRegex)
                for (let i = 1; i < parts.length; i += 2) {
                    const speakerName = parts[i].trim()
                    const text = parts[i + 1]?.trim()
                    if (text) segs.push({ speaker: speakerName, text })
                }
                if (segs.length > 0) return segs
            }
        }
        return typeof transcript === "string"
            ? [{ speaker: "Speaker", text: transcript }]
            : null
    })()

    // ── Keywords toggle ──────────────────────────────────────────────────────
    const handleKeywordsToggle = async (enabled: boolean) => {
        setKeywordsEnabled(enabled)
        if (!enabled) { setKeywords([]); return }
        if (!segments) return

        setKeywordsLoading(true)
        keywordRefsMap.current.clear()
        try {
            const res = await getKeywords(flattenTranscript(segments))
            setKeywords(normaliseKeywords(res.data.keywords))
        } catch {
            toast.error("Failed to extract keywords")
            setKeywordsEnabled(false)
        } finally {
            setKeywordsLoading(false)
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    const handleGenerateSummary = async () => {
        if (!segments) return
        setSummaryLoading(true)
        try {
            const res = await getSummary(flattenTranscript(segments))
            setSummaryData(normaliseSummary(res.data.summary))
        } catch {
            toast.error("Failed to generate summary")
        } finally {
            setSummaryLoading(false)
        }
    }

    // ── Edit handlers ────────────────────────────────────────────────────────
    const handleStartEdit = () => {
        const baseText = savedEditedText ?? (segments ? flattenTranscript(segments) : "")
        setEditedTranscript(baseText)
        setIsEditing(true)
    }

    const handleSaveEdit = () => {
        if (!editedTranscript.trim()) return
        setSavedEditedText(editedTranscript)
        setIsEditing(false)
        toast.success("Transcript saved locally.")
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedTranscript("")
    }

    // ── Download helpers ─────────────────────────────────────────────────────
    const handleDownloadOriginal = () => {
        const text = segments ? flattenTranscript(segments) : ""
        downloadAsText(text, "original")
        toast.success("Downloading original transcript…")
    }

    const handleDownloadEdited = () => {
        if (!savedEditedText) return
        downloadAsText(savedEditedText, "edited")
        toast.success("Downloading edited transcript…")
    }

    // ── First-occurrence ref tracking ────────────────────────────────────────
    const handleFirstOccurrenceRef = useCallback((kw: string, el: HTMLSpanElement) => {
        keywordRefsMap.current.set(kw.toLowerCase(), el)
    }, [])

    // ── Keyword badge click → scroll ─────────────────────────────────────────
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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-lg font-semibold">Transcript Preview</h3>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Keywords toggle */}
                    <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <Label htmlFor="kw-switch" className="text-xs text-muted-foreground cursor-pointer select-none">
                            {keywordsLoading ? "Loading…" : "Enable Keywords"}
                        </Label>
                        <Switch
                            id="kw-switch"
                            checked={keywordsEnabled}
                            onCheckedChange={handleKeywordsToggle}
                            disabled={keywordsLoading || !segments}
                        />
                    </div>

                    {/* Divider */}
                    <span className="h-5 w-px bg-border" />

                    {/* Generate Summary */}
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={handleGenerateSummary}
                        disabled={summaryLoading || !segments}
                    >
                        {summaryLoading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                        }
                        Generate Summary
                    </Button>

                    {/* Existing controls */}
                    <Button variant="outline" size="sm" onClick={onReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        New
                    </Button>

                    {/* Download dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" className="gap-1.5">
                                <Download className="w-3.5 h-3.5" />
                                Download
                                <ChevronDown className="w-3 h-3 ml-0.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Original</DropdownMenuLabel>
                            <DropdownMenuItem onClick={handleDownloadOriginal}>
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                Original (.txt)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDownload("docx")}>
                                <BookOpen className="w-3.5 h-3.5 mr-2" />
                                Original (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDownload("pdf")}>
                                <FileType className="w-3.5 h-3.5 mr-2" />
                                Original (.pdf)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Edited</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={handleDownloadEdited}
                                disabled={!savedEditedText}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-2" />
                                Edited (.txt)
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!savedEditedText} onClick={() => onDownload("docx", true)}>
                                <BookOpen className="w-3.5 h-3.5 mr-2" />
                                Edited (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!savedEditedText} onClick={() => onDownload("pdf", true)}>
                                <FileType className="w-3.5 h-3.5 mr-2" />
                                Edited (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ── Transcript Panel ────────── */}
            <div className="relative flex flex-col h-[500px] border rounded-2xl bg-background shadow-sm overflow-hidden">
                {/* Panel toolbar with edit controls */}
                {segments && (
                    <div className="px-6 py-3 border-b bg-muted/20 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{segments.length} segments</span>
                        {!isEditing ? (
                            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={handleStartEdit}>
                                <Pencil className="w-3 h-3" />
                                Edit
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={handleCancelEdit}>
                                    <X className="w-3 h-3" />
                                    Cancel
                                </Button>
                                <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleSaveEdit}>
                                    <Check className="w-3 h-3" />
                                    Save
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {!segments ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground italic">
                        No transcript data available
                    </div>
                ) : isEditing ? (
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
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                        {segments.map((seg, i) => {
                            const isFirstInGroup = i === 0 || segments[i - 1].speaker !== seg.speaker
                            const colorClass = speakerColor(seg.speaker)
                            const [bg, text, border] = colorClass.split(" ")

                            return (
                                <div key={i} className={`flex flex-col ${isFirstInGroup ? "mt-2" : "mt-1"}`}>
                                    {isFirstInGroup && (
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${bg} ${text} ${border}`}>
                                                {seg.speaker.slice(-1)}
                                            </div>
                                            <span className="text-xs font-bold text-foreground/80">{seg.speaker}</span>
                                            {showTimestamps && seg.start !== undefined && (
                                                <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                                                    {formatTime(seg.start)}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className={`max-w-[85%] self-start ml-8 px-4 py-2.5 rounded-2xl border bg-white shadow-sm text-sm leading-relaxed text-foreground transition-all hover:shadow-md ${border}`}>
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
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Summary overlay panel */}
                {summaryData && (
                    <SummaryPanel
                        summary={summaryData}
                        onClose={() => setSummaryData(null)}
                    />
                )}
            </div>

            {/* ── Detected Keywords Tags ────────────────────────────────────── */}
            {keywordsEnabled && keywords.length > 0 && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Detected Keywords
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((kw) => (
                            <Badge
                                key={kw}
                                variant="outline"
                                className="cursor-pointer bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors text-xs px-2.5 py-1"
                                onClick={() => scrollToKeyword(kw)}
                            >
                                {kw}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
