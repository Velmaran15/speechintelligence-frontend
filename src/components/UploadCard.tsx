import { useState } from "react"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import BatchUploadZone from "./BatchUploadZone"
import JobList from "./JobList"
import JobDetail from "./JobDetail"
import { submitBatch } from "@/api/api"

type View = "upload" | "jobs" | "detail"

export default function UploadCard() {
  const [view, setView] = useState<View>("upload")
  const [batchId, setBatchId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Submit up to 20 files as a batch ──────────────────────────────────────
  const handleBatchSubmit = async (
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
  ) => {
    try {
      setSubmitting(true)
      const formData = new FormData()

      files.forEach((f) => formData.append("files", f))
      formData.append("diarization", String(options.diarization))
      formData.append("cleanTranscript", String(options.cleanTranscript))
      formData.append("timestamps", String(options.timestamps))
      formData.append("language", options.language)
      formData.append("targetLanguage", options.targetLanguage === "none" ? "" : options.targetLanguage)
      formData.append("transliteration", String(options.transliteration))
      formData.append("translation", String(options.translation))
      formData.append("provider", options.provider)

      const res = await submitBatch(formData)

      // Backend returns { batchId } or { id }
      const id: string = res.data.batchId ?? res.data.id
      if (!id) throw new Error("No batch ID returned")

      setBatchId(id)
      setView("jobs")
      toast.success(`Batch submitted! ${files.length} file${files.length > 1 ? "s" : ""} queued.`)
    } catch (err: any) {
      toast.error(`Batch submission failed: ${err.message || 'Unknown error'}. Please check console.`)
      console.error("[UploadCard] submitBatch error", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId)
    setView("detail")
  }

  const handleBackToJobs = () => {
    setSelectedJobId(null)
    setView("jobs")
  }

  const handleReset = () => {
    setBatchId(null)
    setSelectedJobId(null)
    setView("upload")
  }

  return (
    <Card className="w-full max-w-4xl mx-auto border rounded-2xl shadow-2xl bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">

      {/* Header – shown on upload & jobs view */}
      {view !== "detail" && (
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-2xl font-semibold">
                {view === "upload" ? "Audio Transcription Studio" : "Batch Jobs"}
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {view === "upload"
                  ? "Upload up to 20 audio files and generate structured transcripts with speaker detection."
                  : "Track the status of each file in this batch. Click View on a completed job to read its transcript."}
              </p>
            </div>

            {/* "New Batch" button when viewing jobs */}
            {view === "jobs" && (
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                + New Batch
              </button>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-8 p-8">

        {/* ── VIEW: UPLOAD ─────────────────────────────────────────────── */}
        {view === "upload" && (
          <BatchUploadZone onSubmit={handleBatchSubmit} loading={submitting} />
        )}

        {/* ── VIEW: JOB LIST ───────────────────────────────────────────── */}
        {view === "jobs" && batchId && (
          <JobList batchId={batchId} onSelectJob={handleSelectJob} />
        )}

        {/* ── VIEW: JOB DETAIL ─────────────────────────────────────────── */}
        {view === "detail" && selectedJobId && (
          <JobDetail jobId={selectedJobId} onBack={handleBackToJobs} />
        )}

      </CardContent>
    </Card>
  )
}