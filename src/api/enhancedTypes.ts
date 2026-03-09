/**
 * Enhanced API types and interfaces for improved accuracy tracking
 * This file provides forward-compatible types for upcoming features
 */

// ─── DIARIZATION ENHANCEMENTS ──────────────────────────────────────────────

export interface DiarizedSegment {
    speaker: string
    start?: number
    end?: number
    text: string
    
    // New fields for accuracy improvement
    confidence?: number              // 0-1 speaker identification confidence
    isOverlappingSpeech?: boolean   // Detect multiple speakers simultaneously
    speakerVerificationScore?: number // Cross-segment speaker consistency
    speakerId?: string              // Unique speaker identifier
}

// ─── KEYWORD ENHANCEMENTS ─────────────────────────────────────────────────

export type KeywordType = 
    | 'PERSON' 
    | 'LOCATION' 
    | 'ORGANIZATION' 
    | 'CONCEPT' 
    | 'ACTION' 
    | 'PRODUCT' 
    | 'TECHNOLOGY'
    | 'METRIC'

export interface EnhancedKeyword {
    word: string
    type: KeywordType
    relevance: number              // 0-1 relevance score
    frequency: number              // occurrence count
    firstMentionTime?: number      // timestamp of first mention
    confidence?: number            // extraction confidence
    context?: string               // surrounding text snippet
}

export interface KeywordResponse {
    keywords: EnhancedKeyword[]
    totalKeywords: number
    confidence: number             // overall extraction confidence
    extractionMethod?: string      // 'frequency' | 'semantic' | 'ner'
}

// ─── SUMMARY ENHANCEMENTS ────────────────────────────────────────────────

export type SummaryStyle = 'extractive' | 'abstractive' | 'hybrid'
export type SummaryLength = 'brief' | 'standard' | 'detailed'

export interface SummaryRequest {
    transcript: string
    length?: SummaryLength
    style?: SummaryStyle
    includeActionItems?: boolean
    includeMetrics?: boolean
    focusAreas?: string[]          // Focus on specific topics
}

export interface ActionItem {
    description: string
    assigned?: string              // from speaker
    dueDate?: string
    priority?: 'high' | 'medium' | 'low'
    sourceTime?: number            // when mentioned
}

export interface SummaryMetrics {
    totalSpeakers: number
    averagePercentage: Record<string, number>    // Speaker participation %
    topicCoverage: Record<string, number>        // Time per topic %
    dominantTopic: string
    keyDecisions: number
    actionItems: number
}

export interface EnhancedSummaryResponse {
    summary: string[]
    summaryStyle: SummaryStyle
    summaryLength: SummaryLength
    confidence: number             // 0-1 quality confidence
    
    // Advanced fields
    actionItems?: ActionItem[]
    decisions?: string[]
    metrics?: SummaryMetrics
    sourceSegments?: number[]      // indices of used transcript segments
    topicTimeline?: Array<{
        topic: string
        startTime: number
        endTime: number
    }>
}

// ─── JOB METADATA ENHANCEMENTS ────────────────────────────────────────────

export interface JobMetadata {
    audioQuality: 'excellent' | 'good' | 'fair' | 'poor'
    backgroundNoise?: boolean
    accentVariety?: string
    processedAt?: string
    processingDuration?: number      // milliseconds
    
    // Accuracy scores
    diarizationScore?: number        // 0-1
    transcriptionConfidence?: number // 0-1
    overallQuality?: number          // 0-1
}

export interface EnhancedJobData {
    id: string
    status: "pending" | "processing" | "completed" | "failed"
    transcript?: string | DiarizedSegment[]
    originalName?: string
    filename?: string
    error?: string
    includeTimestamps?: boolean
    
    // New metadata
    metadata?: JobMetadata
    language?: string
    duration?: number
    speakers?: Array<{
        id: string
        name: string
        confidence: number
        duration: number            // seconds
    }>
}

// ─── API SERVICE ENHANCEMENTS ────────────────────────────────────────────

import axios from "axios"

const API = axios.create({
    baseURL: "http://localhost:5412/v1/",
})

// Enhanced keyword endpoint
export const getKeywordsEnhanced = (
    transcript: string,
    options?: {
        filterByType?: KeywordType[]
        minRelevance?: number
        maxResults?: number
    }
) =>
    API.post<KeywordResponse>("/ai/keywords", { 
        transcript,
        ...options
    })

// Enhanced summary endpoint
export const getSummaryEnhanced = (
    transcript: string,
    options?: {
        length?: SummaryLength
        style?: SummaryStyle
        includeActionItems?: boolean
        includeMetrics?: boolean
    }
) =>
    API.post<EnhancedSummaryResponse>("/ai/summary", { 
        transcript,
        ...options
    })

// New endpoint for diarization confidence
export const getDiarizationScores = (jobId: string) =>
    API.get<{
        segments: Array<DiarizedSegment & { confidence: number }>
        overallScore: number
        warnings: string[]
    }>(`/jobs/${jobId}/diarization/scores`)

// Batch operation for multiple analyses
export const analyzeTranscriptComprehensive = (
    transcript: string | DiarizedSegment[],
    options?: {
        includeKeywords?: boolean
        includeSummary?: boolean
        includeDiarizationScores?: boolean
    }
) => {
    const text = Array.isArray(transcript)
        ? transcript.map(s => `${s.speaker}: ${s.text}`).join('\n')
        : transcript
        
    return API.post("/ai/analyze", {
        transcript: text,
        ...options
    })
}

export default API
