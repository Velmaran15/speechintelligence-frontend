import { useRef, useState } from "react"
import type { DragEvent, ChangeEvent } from "react"
import { X, Upload, Music, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import ProcessingOptions from "./ProcessingOptions"
import { toast } from "sonner"

interface BatchUploadZoneProps {
    onSubmit: (
        files: File[],
        options: {
            diarization: boolean
            cleanTranscript: boolean
            timestamps: boolean
            language: string
            targetLanguage: string
            transliteration: boolean
            translation: boolean
            provider: string
        }
    ) => Promise<void>
    loading: boolean
}

interface RejectedFile {
    name: string
    reason: string
}

const MAX_FILES = 20
const MAX_MB = 100
// Extension-only check — MIME is unreliable (e.g. .opus reports as audio/ogg)
const ACCEPTED_EXTS = /\.(mp3|wav|m4a|ogg|flac)$/i

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BatchUploadZone({ onSubmit, loading }: BatchUploadZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<File[]>([])
    const [rejectedFiles, setRejected] = useState<RejectedFile[]>([])
    const [dragging, setDragging] = useState(false)

    // Processing options
    const [diarization, setDiarization] = useState(true)
    const [cleanTranscript, setCleanTranscript] = useState(false)
    const [timestamps, setTimestamps] = useState(false)
    const [targetLanguage, setTargetLanguage] = useState("none")
    const [transliteration, setTransliteration] = useState(false)
    const [translation, setTranslation] = useState(false)
    const [provider, setProvider] = useState("sarvam")

    const addFiles = (incoming: FileList | File[]) => {
        const arr = Array.from(incoming)
        const valid: File[] = []
        const rejected: RejectedFile[] = []

        arr.forEach((f) => {
            // Validate by extension only — MIME is unreliable across browsers
            // (e.g. .opus files report as audio/ogg, same as .ogg)
            const badType = !ACCEPTED_EXTS.test(f.name)
            const tooLarge = f.size > MAX_MB * 1024 * 1024

            if (badType) {
                rejected.push({
                    name: f.name,
                    reason: `Unsupported format — accepted: MP3, WAV, M4A, OGG, FLAC.`,
                })
            } else if (tooLarge) {
                rejected.push({
                    name: f.name,
                    reason: `File too large (${formatBytes(f.size)}) — max ${MAX_MB} MB.`,
                })
            } else {
                valid.push(f)
            }
        })

        // Show a combined toast only if there are rejections mixed with valid
        if (rejected.length > 0 && valid.length > 0) {
            toast.warning(`${rejected.length} file(s) couldn't be added — see details below.`)
        } else if (rejected.length > 0 && valid.length === 0) {
            toast.error("None of the selected files are valid audio files.")
        }

        // Add rejected to the inline rejected list
        if (rejected.length > 0) {
            setRejected((prev) => [...prev, ...rejected])
        }

        if (valid.length > 0) {
            setFiles((prev) => {
                const combined = [...prev, ...valid]
                if (combined.length > MAX_FILES) {
                    toast.error(`Maximum ${MAX_FILES} files allowed.`)
                    return combined.slice(0, MAX_FILES)
                }
                return combined
            })
        }
    }

    const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))
    const dismissReject = (index: number) => setRejected((prev) => prev.filter((_, i) => i !== index))

    // Drag & drop
    const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = () => setDragging(false)
    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
    }

    const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) addFiles(e.target.files)
        e.target.value = ""                     // allow re-selecting the same file
    }

    const handleSubmit = async () => {
        if (files.length === 0) {
            toast.error(
                rejectedFiles.length > 0
                    ? "Please fix or remove the invalid files before submitting."
                    : "Please select at least one valid audio file."
            )
            return
        }

        if ((translation || transliteration) && targetLanguage === "none") {
            toast.error("Please select a target language for translation/transliteration.")
            return
        }

        await onSubmit(files, {
            diarization,
            cleanTranscript,
            timestamps,
            language: "auto",
            targetLanguage,
            transliteration,
            translation,
            provider
        })
    }

    const hasAny = files.length > 0 || rejectedFiles.length > 0
    const onlyErrors = rejectedFiles.length > 0 && files.length === 0

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">

            {/* ── Drop zone ─────────────────────────────────────────────── */}
            <div
                className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer
          ${dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary hover:bg-muted/40"}
          ${hasAny ? "p-6" : "p-14"}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".mp3,.wav,.m4a,.ogg,.flac,audio/mpeg,audio/wav,audio/mp4,audio/m4a,audio/ogg,audio/flac"
                    className="hidden"
                    onChange={onInputChange}
                />

                {/* ── Empty state ───────────────────────────────────── */}
                {!hasAny && (
                    <div className="text-center space-y-3 pointer-events-none">
                        <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-primary">
                            <Upload className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">Click to upload or drag & drop</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                MP3, WAV, M4A, OGG, FLAC &nbsp;·&nbsp; max {MAX_MB} MB each &nbsp;·&nbsp; up to {MAX_FILES} files
                            </p>
                        </div>
                    </div>
                )}

                {/* ── File list ─────────────────────────────────────── */}
                {hasAny && (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Music className="w-4 h-4 text-primary" />
                                {files.length} / {MAX_FILES} files selected
                                {rejectedFiles.length > 0 && (
                                    <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {rejectedFiles.length} invalid
                                    </span>
                                )}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => inputRef.current?.click()}
                                disabled={files.length >= MAX_FILES}
                            >
                                + Add more
                            </Button>
                        </div>

                        {/* Scrollable combined list */}
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">

                            {/* Valid files */}
                            {files.map((f, i) => (
                                <div
                                    key={`valid-${f.name}-${i}`}
                                    className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5 group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-primary text-base shrink-0">🎵</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate max-w-xs">{f.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(i)}
                                        className="ml-3 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                        title="Remove file"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {/* Rejected files — inline error rows */}
                            {rejectedFiles.map((rf, i) => (
                                <div
                                    key={`rejected-${rf.name}-${i}`}
                                    className="flex items-start justify-between bg-destructive/8 border border-destructive/30 rounded-xl px-4 py-2.5"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate max-w-xs text-destructive">{rf.name}</p>
                                            <p className="text-xs text-destructive/80 mt-0.5">{rf.reason}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => dismissReject(i)}
                                        className="ml-3 text-destructive/60 hover:text-destructive transition-colors shrink-0 mt-0.5"
                                        title="Dismiss"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Format hint */}
                        <p className="text-xs text-muted-foreground text-center pt-1">
                            Drop more files · Accepted: MP3, WAV, M4A, OGG, FLAC
                        </p>
                    </div>
                )}
            </div>

            {/* ── Provider ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Label htmlFor="provider-select" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    Provider
                </Label>
                <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger id="provider-select" className="w-40 h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="sarvam">Sarvam</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ── Processing Options ────────────────────────────────────── */}
            <ProcessingOptions
                diarization={diarization}
                setDiarization={setDiarization}
                cleanTranscript={cleanTranscript}
                setCleanTranscript={setCleanTranscript}
                timestamps={timestamps}
                setTimestamps={setTimestamps}
                targetLanguage={targetLanguage}
                setTargetLanguage={setTargetLanguage}
                transliteration={transliteration}
                setTransliteration={setTransliteration}
                translation={translation}
                setTranslation={setTranslation}
            />

            {/* ── Submit ───────────────────────────────────────────────── */}
            {onlyErrors ? (
                <div className="flex items-center gap-3 w-full h-14 rounded-xl border border-destructive/40 bg-destructive/8 px-5">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm font-medium text-destructive">
                        Fix or remove the invalid files above before submitting.
                    </p>
                </div>
            ) : (
                <Button
                    size="lg"
                    className="w-full h-14 text-base font-semibold rounded-xl"
                    onClick={handleSubmit}
                    disabled={files.length === 0 || loading}
                >
                    {loading
                        ? "Submitting…"
                        : `Start Batch · ${files.length} file${files.length !== 1 ? "s" : ""}`}
                </Button>
            )}
        </div>
    )
}
