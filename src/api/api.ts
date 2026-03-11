import axios from "axios";

const API = axios.create({
  baseURL: "https://my-app-150979881460.asia-south1.run.app/v1/",
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
export const downloadJobFile = (jobId: string, format: "txt" | "docx" | "pdf") => {
  const url = `https://my-app-150979881460.asia-south1.run.app/v1/documents/${jobId}/download/${format}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `Transcript_${jobId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// ─── AI ──────────────────────────────────────────────────────────────────────
/** POST /ai/keywords – extract keywords from transcript text */
export const getKeywords = (transcript: string) =>
  API.post<KeywordResponse>("/ai/keywords", { transcript });

/** POST /ai/summary – generate 5-bullet summary from transcript text */
export const getSummary = (transcript: string, targetLanguage?: string) =>
  API.post<SummaryResponse>("/ai/summary", { transcript, targetLanguage });
