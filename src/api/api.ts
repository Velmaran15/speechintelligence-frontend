import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8080/v1/",
});

// ─── Types ────────────────────────────────────────────────────────────────

export interface DiarizedSegment {
  speaker: string;
  start?: number;
  end?: number;
  text: string;
  confidence?: number;
  isOverlappingSpeech?: boolean;
}

export interface KeywordResponse {
  keywords: string[];
  confidence?: number;
  extractionMethod?: string;
}

export interface SummaryResponse {
  summary: string[];
  confidence?: number;
  actionItems?: string[];
}

// ─── Batch ───────────────────────────────────────────────────────────────────
/** POST /batches  – submit up to 20 audio files */
export const submitBatch = (formData: FormData) =>
  API.post("/batches", formData);

/** GET /batches/:id – returns { id, jobs: Job[] } */
export const getBatchStatus = (batchId: string) =>
  API.get(`/batches/${batchId}`);

// ─── Job ─────────────────────────────────────────────────────────────────────
/** GET /jobs/:id – returns { id, status, transcript, filename, … } */
export const getJobStatus = (jobId: string) =>
  API.get(`/jobs/${jobId}`);

/** POST /jobs/:id/retry */
export const retryJob = (jobId: string) =>
  API.post(`/jobs/${jobId}/retry`);

// ─── Documents ───────────────────────────────────────────────────────────────
/** Trigger a browser download for the given format (txt | docx | pdf) */
export const downloadJobFile = (
  jobId: string,
  format: "txt" | "docx" | "pdf",
  type: "transcript" | "summary" | "combined" = "transcript",
  version: "original" | "edited" = "original"
) => {
  const url = `http://localhost:8080/v1/documents/${jobId}/download?format=${format}&type=${type}&version=${version}`;
  const a = document.createElement("a");
  a.href = url;
  // Let the browser handle the filename from Content-Disposition header if possible, 
  // but setting it here as a fallback
  a.download = `${type}_${jobId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// ─── Transcript Edit ─────────────────────────────────────────────────────────
/** PATCH /jobs/:id/transcript – persist a user-edited transcript */
export const saveEditedTranscript = (jobId: string, text: string) =>
  API.patch(`/jobs/${jobId}/transcript`, { editedTranscript: text });

/** Download original or edited transcript as a .txt file (client-side blob) */
export const downloadTranscriptAsText = (
  jobId: string,
  type: "original" | "edited",
  text: string
) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Transcript_${jobId}_${type}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─── AI ──────────────────────────────────────────────────────────────────────
/** POST /ai/keywords – extract keywords from transcript text */
export const getKeywords = (transcript: string, jobId?: string) =>
  API.post<KeywordResponse>("/ai/keywords", { transcript, jobId });

/** POST /ai/summary – generate 5-bullet summary from transcript text */
export const getSummary = (transcript: string, targetLanguage?: string, jobId?: string) =>
  API.post<SummaryResponse>("/ai/summary", { transcript, targetLanguage, jobId });
