/**
 * Example component showing how to display enhanced accuracy features
 * This demonstrates the improved UI for diarization, keywords, and summary
 */

import { type DiarizedSegment, type EnhancedKeyword, type EnhancedSummaryResponse } from "@/api/enhancedTypes"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react"

// ─── ENHANCED SPEAKER DISPLAY WITH CONFIDENCE ────────────────────────────
interface EnhancedSpeakerSegmentProps {
    segment: DiarizedSegment
    speakerColor: string
    showMetrics?: boolean
}

export function EnhancedSpeakerSegment({
    segment,
    speakerColor,
    showMetrics = true,
}: EnhancedSpeakerSegmentProps) {
    const confidence = segment.confidence ?? 0.95
    const confidencePercent = Math.round(confidence * 100)
    
    return (
        <div className="space-y-2">
            {/* Speaker badge with confidence */}
            <div className="flex items-center gap-2">
                <Badge className={speakerColor}>
                    {segment.speaker}
                </Badge>
                
                {/* Confidence indicator */}
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                        {confidencePercent}%
                    </span>
                    <div 
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                            backgroundColor: 
                                confidence > 0.9 ? '#22c55e' :
                                confidence > 0.7 ? '#eab308' :
                                '#ef4444'
                        }}
                    />
                </div>
                
                {/* Warnings */}
                {segment.isOverlappingSpeech && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Overlap
                    </Badge>
                )}
            </div>
            
            {/* Confidence progress bar (optional) */}
            {showMetrics && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Confidence:</span>
                    <Progress value={confidence * 100} className="flex-1 h-1.5" />
                </div>
            )}
            
            {/* Transcript text */}
            <p className="text-sm leading-relaxed text-foreground">
                {segment.text}
            </p>
        </div>
    )
}

// ─── ENHANCED KEYWORDS WITH CATEGORIES ────────────────────────────────────
interface EnhancedKeywordDisplayProps {
    keywords: EnhancedKeyword[]
    onKeywordClick?: (keyword: EnhancedKeyword) => void
    filterByType?: string
    minRelevance?: number
}

export function EnhancedKeywordDisplay({
    keywords,
    onKeywordClick,
    filterByType,
    minRelevance = 0,
}: EnhancedKeywordDisplayProps) {
    const filtered = keywords.filter(k => 
        (!filterByType || k.type === filterByType) &&
        (k.relevance || 0.5) >= minRelevance
    )
    
    // Group by type
    const grouped = filtered.reduce((acc, kw) => {
        if (!acc[kw.type]) acc[kw.type] = []
        acc[kw.type].push(kw)
        return acc
    }, {} as Record<string, EnhancedKeyword[]>)
    
    const typeColors: Record<string, string> = {
        PERSON: 'bg-blue-50 text-blue-700 border-blue-200',
        LOCATION: 'bg-green-50 text-green-700 border-green-200',
        ORGANIZATION: 'bg-purple-50 text-purple-700 border-purple-200',
        CONCEPT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        ACTION: 'bg-orange-50 text-orange-700 border-orange-200',
        PRODUCT: 'bg-pink-50 text-pink-700 border-pink-200',
        TECHNOLOGY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        METRIC: 'bg-amber-50 text-amber-700 border-amber-200',
    }
    
    return (
        <div className="space-y-4">
            {Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {type}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                            ({items.length})
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {items.map((kw) => {
                            const relevance = kw.relevance || 0.5
                            const isHighConfidence = relevance > 0.8
                            
                            return (
                                <div
                                    key={kw.word}
                                    className="relative group cursor-pointer"
                                    onClick={() => onKeywordClick?.(kw)}
                                >
                                    <Badge
                                        className={`${typeColors[type] || typeColors.CONCEPT} transition-all group-hover:shadow-md`}
                                        title={`Relevance: ${Math.round(relevance * 100)}% | Mentions: ${kw.frequency}`}
                                    >
                                        {kw.word}
                                        {isHighConfidence && (
                                            <CheckCircle2 className="w-2.5 h-2.5 ml-1" />
                                        )}
                                    </Badge>
                                    
                                    {/* Tooltip on hover */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-900 text-white text-xs rounded hidden group-hover:block whitespace-nowrap">
                                        <div>Relevance: {Math.round(relevance * 100)}%</div>
                                        <div>Frequency: {kw.frequency}x</div>
                                        {kw.confidence && (
                                            <div>Confidence: {Math.round(kw.confidence * 100)}%</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── ENHANCED SUMMARY WITH METADATA ───────────────────────────────────────
interface EnhancedSummaryDisplayProps {
    summaryData: EnhancedSummaryResponse
    onStyleChange?: (style: 'extractive' | 'abstractive' | 'hybrid') => void
    onLengthChange?: (length: 'brief' | 'standard' | 'detailed') => void
}

export function EnhancedSummaryDisplay({
    summaryData,
    onStyleChange,
    onLengthChange,
}: EnhancedSummaryDisplayProps) {
    const mainColor = summaryData.confidence > 0.9 ? 'text-green-600' :
                      summaryData.confidence > 0.7 ? 'text-yellow-600' :
                      'text-red-600'
    
    return (
        <div className="space-y-4">
            {/* Header with quality metric */}
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">Summary</h3>
                <div className="flex items-center gap-2">
                    <TrendingUp className={`w-4 h-4 ${mainColor}`} />
                    <span className={`text-sm font-medium ${mainColor}`}>
                        {Math.round(summaryData.confidence * 100)}% Quality
                    </span>
                </div>
            </div>
            
            {/* Style and length selectors */}
            <div className="flex gap-2">
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Style</label>
                    <select 
                        onChange={(e) => onStyleChange?.(e.target.value as any)}
                        className="text-xs border rounded px-2 py-1"
                    >
                        <option value="abstractive">Abstractive (AI-generated)</option>
                        <option value="extractive">Extractive (Key sentences)</option>
                        <option value="hybrid">Hybrid</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground block mb-1">Length</label>
                    <select 
                        onChange={(e) => onLengthChange?.(e.target.value as any)}
                        className="text-xs border rounded px-2 py-1"
                    >
                        <option value="brief">Brief</option>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed</option>
                    </select>
                </div>
            </div>
            
            {/* Summary bullets */}
            <div className="space-y-2 bg-slate-50 rounded-lg p-4">
                {summaryData.summary.map((point, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="text-primary font-bold min-w-5">•</span>
                        <p className="text-sm leading-relaxed text-foreground">{point}</p>
                    </div>
                ))}
            </div>
            
            {/* Action items if present */}
            {summaryData.actionItems && summaryData.actionItems.length > 0 && (
                <div className="space-y-2 bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="text-sm font-semibold text-amber-900">Action Items</h4>
                    {summaryData.actionItems.map((item, i) => (
                        <div key={i} className="text-sm text-amber-800">
                            <div className="flex items-start gap-2">
                                <input type="checkbox" className="mt-0.5" />
                                <div>
                                    <p>{item.description}</p>
                                    {item.assigned && (
                                        <p className="text-xs text-amber-600 mt-0.5">
                                            Assigned to: {item.assigned}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Metrics if present */}
            {summaryData.metrics && (
                <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold">Meeting Metrics</h4>
                    
                    {/* Speaker participation */}
                    {summaryData.metrics.averagePercentage && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                Speaker Participation
                            </p>
                            <div className="space-y-1">
                                {Object.entries(summaryData.metrics.averagePercentage).map(([speaker, percent]) => (
                                    <div key={speaker} className="flex items-center gap-2">
                                        <span className="text-xs w-24">{speaker}</span>
                                        <Progress value={percent} className="flex-1" />
                                        <span className="text-xs text-muted-foreground min-w-8">
                                            {Math.round(percent)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <p className="text-muted-foreground">Total Speakers</p>
                            <p className="text-lg font-bold">{summaryData.metrics.totalSpeakers}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Decisions</p>
                            <p className="text-lg font-bold">{summaryData.metrics.keyDecisions}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Action Items</p>
                            <p className="text-lg font-bold">{summaryData.metrics.actionItems}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Main Topic</p>
                            <p className="text-sm font-semibold truncate">{summaryData.metrics.dominantTopic}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── ACCURACY DASHBOARD ───────────────────────────────────────────────────
interface AccuracyDashboardProps {
    diarizationScore?: number
    keywordConfidence?: number
    summaryQuality?: number
}

export function AccuracyDashboard({
    diarizationScore = 0.92,
    keywordConfidence = 0.85,
    summaryQuality = 0.88,
}: AccuracyDashboardProps) {
    const metrics = [
        { label: 'Speaker ID', score: diarizationScore, icon: '👤' },
        { label: 'Keywords', score: keywordConfidence, icon: '🏷️' },
        { label: 'Summary', score: summaryQuality, icon: '📝' },
    ]
    
    return (
        <div className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
                <div key={metric.label} className="space-y-2 p-3 bg-slate-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{metric.icon} {metric.label}</span>
                        <span className="text-lg font-bold">
                            {Math.round(metric.score * 100)}%
                        </span>
                    </div>
                    <Progress value={metric.score * 100} className="h-2" />
                </div>
            ))}
        </div>
    )
}
