import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

interface ProcessingOptionsProps {
    diarization: boolean
    setDiarization: (val: boolean) => void
    cleanTranscript: boolean
    setCleanTranscript: (val: boolean) => void
    timestamps: boolean
    setTimestamps: (val: boolean) => void
    targetLanguage: string
    setTargetLanguage: (val: string) => void
    transliteration: boolean
    setTransliteration: (val: boolean) => void
    translation: boolean
    setTranslation: (val: boolean) => void
    segmentation: boolean
    setSegmentation: (val: boolean) => void
}

export default function ProcessingOptions({
    diarization,
    setDiarization,
    cleanTranscript,
    setCleanTranscript,
    timestamps,
    setTimestamps,
    targetLanguage,
    setTargetLanguage,
    transliteration,
    setTransliteration,
    translation,
    setTranslation,
    segmentation,
    setSegmentation,
}: ProcessingOptionsProps) {
    const handleDiarizationChange = (val: boolean) => {
        setDiarization(val)
        if (val) setSegmentation(false)
    }

    const handleSegmentationChange = (val: boolean) => {
        setSegmentation(val)
        if (val) setDiarization(false)
    }

    return (
        <div className="space-y-6">

            <div className="grid md:grid-cols-2 gap-6">

                {/* Left Side: Translation/Language */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className={`text-sm font-medium ${!(translation || transliteration) ? "text-muted-foreground" : "text-foreground"}`}>
                            Translate To {(translation || transliteration) && <span className="text-destructive">*</span>}
                        </label>

                        <Select
                            value={targetLanguage}
                            onValueChange={setTargetLanguage}
                            disabled={!(translation || transliteration)}
                        >
                            <SelectTrigger className={!(translation || transliteration) ? "opacity-50" : ""}>
                                <SelectValue placeholder="Select language" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="none">Select a language</SelectItem>
                                <SelectItem value="en-IN">English</SelectItem>
                                <SelectItem value="ta-IN">Tamil</SelectItem>
                                <SelectItem value="hi-IN">Hindi</SelectItem>
                            </SelectContent>
                        </Select>
                        {!(translation || transliteration) && (
                            <p className="text-[10px] text-muted-foreground italic">
                                Check "Translation" or "Transliteration" under options to enable.
                            </p>
                        )}
                    </div>
                </div>


                {/* Checkbox Options */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/20 text-foreground">
                    <label className="text-base font-semibold">Processing Options</label>

                    <div className={`flex items-center space-x-2 transition-all duration-200 ${segmentation ? "opacity-30 grayscale-[50%]" : ""}`}>
                        <Checkbox
                            id="diarization"
                            checked={diarization}
                            onCheckedChange={(c) => handleDiarizationChange(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none w-full">
                            <label
                                htmlFor="diarization"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Speaker Identification
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Identify who is speaking (Speaker 1, Speaker 2...)
                            </p>
                        </div>
                    </div>

                    <div className={`flex items-center space-x-2 transition-all duration-200 ${diarization ? "opacity-30 grayscale-[50%]" : ""}`}>
                        <Checkbox
                            id="segmentation"
                            checked={segmentation}
                            onCheckedChange={(c) => handleSegmentationChange(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none w-full">
                            <label
                                htmlFor="segmentation"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Silence Detection (Segmentation)
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Split transcript by silence duration
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="cleanTranscript"
                            checked={cleanTranscript}
                            onCheckedChange={(c) => setCleanTranscript(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="cleanTranscript"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Clean Transcript
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Remove filler words (um, uh, like)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="timestamps"
                            checked={timestamps}
                            onCheckedChange={(c) => setTimestamps(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="timestamps"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Include Timestamps
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-border my-2" />

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="transliteration"
                            checked={transliteration}
                            onCheckedChange={(c) => setTransliteration(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="transliteration"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Transliteration(Tanglish)
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Convert script to another phonetic representation.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="translation"
                            checked={translation}
                            onCheckedChange={(c) => setTranslation(!!c)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="translation"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Translation
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Translate transcript to another language.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
