import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryPanelProps {
    summary: string[];
    onClose: () => void;
}

/**
 * Floating summary card that slides in from the right.
 * Wrap usage in <AnimatePresence> at call site OR use built-in one below.
 */
export default function SummaryPanel({ summary, onClose }: SummaryPanelProps) {
    return (
        <AnimatePresence>
            <motion.div
                key="summary-panel"
                initial={{ x: "110%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "110%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute top-0 right-0 h-full w-80 z-20 flex flex-col"
            >
                <div className="flex flex-col h-full bg-white/95 backdrop-blur-sm border-l border-border shadow-2xl rounded-r-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-violet-50 to-indigo-50">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            <span className="text-sm font-semibold text-foreground">AI Summary</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-muted"
                            onClick={onClose}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {summary.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No summary available.</p>
                        ) : (
                            summary.map((point, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="flex items-start gap-3"
                                >
                                    {/* Bullet dot */}
                                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400" />
                                    <p className="text-sm leading-relaxed text-foreground/90">{point}</p>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t bg-muted/20">
                        <p className="text-[11px] text-muted-foreground text-center">
                            {summary.length} key points
                        </p>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
