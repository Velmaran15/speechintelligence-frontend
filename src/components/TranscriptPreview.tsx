import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Loader2, RotateCcw, Sparkles, Tag } from "lucide-react"
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
    onDownload: () => void
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

    // Map from keyword (lowercase) → first DOM element
    const keywordRefsMap = useRef<Map<string, HTMLSpanElement>>(new Map())

    const segments: DiarizedSegment[] | null = (() => {
        if (!transcript) return null
        if (Array.isArray(transcript)) return transcript

        try {
            const parsed = JSON.parse(transcript)
            if (Array.isArray(parsed)) return parsed
        } catch {
            const speakerRegex = /(Speaker \d+|Person [A-Z]):/g
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
            setKeywords(res.data.keywords ?? [])
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
            setSummaryData(res.data.summary ?? [])
        } catch {
            toast.error("Failed to generate summary")
        } finally {
            setSummaryLoading(false)
        }
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
                    <Button onClick={onDownload} size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download .docx
                    </Button>
                </div>
            </div>

            {/* ── Transcript Panel (relative for summary overlay) ────────── */}
            <div className="relative flex flex-col h-[500px] border rounded-2xl bg-background shadow-sm overflow-hidden">
                {!segments ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground italic">
                        No transcript data available
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
