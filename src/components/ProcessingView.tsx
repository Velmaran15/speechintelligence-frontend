import { Loader2 } from "lucide-react"

export default function ProcessingView() {
    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Processing Audio...</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    We are analyzing your file, identifying speakers, and generating the transcript. This may take a moment.
                </p>
            </div>
        </div>
    )
}
