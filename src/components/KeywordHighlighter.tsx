import { useRef } from "react";

interface KeywordHighlighterProps {
    text: string;
    keywords: string[];
    /** Called with the DOM span element on the first occurrence of each keyword */
    onFirstOccurrenceRef?: (keyword: string, el: HTMLSpanElement) => void;
}

/**
 * Renders `text` with keyword occurrences highlighted in amber.
 * Tracks the first DOM occurrence of each keyword via `onFirstOccurrenceRef`.
 */
export default function KeywordHighlighter({
    text,
    keywords,
    onFirstOccurrenceRef,
}: KeywordHighlighterProps) {
    // Track which keywords we've already registered a ref for
    const registeredRef = useRef<Set<string>>(new Set());

    if (!keywords.length) return <>{text}</>;

    // Sort keywords by length descending so longer phrases match before their substrings
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);

    // Build a single regex that matches any keyword (case-insensitive)
    const escaped = sortedKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");

    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) => {
                // Every odd-indexed part is a match captured by the regex group
                const isMatch = i % 2 === 1;
                if (!isMatch) return part;

                const lowerPart = part.toLowerCase();
                const matchedKeyword = keywords.find((k) => k.toLowerCase() === lowerPart) ?? part;
                const isFirst = !registeredRef.current.has(lowerPart);

                return (
                    <mark
                        key={i}
                        ref={(el) => {
                            if (el && isFirst && onFirstOccurrenceRef) {
                                registeredRef.current.add(lowerPart);
                                onFirstOccurrenceRef(matchedKeyword, el);
                            }
                        }}
                        className="bg-amber-100 text-amber-900 rounded px-0.5 font-medium not-italic"
                        style={{ backgroundColor: undefined }} // let className win
                    >
                        {part}
                    </mark>
                );
            })}
        </>
    );
}
