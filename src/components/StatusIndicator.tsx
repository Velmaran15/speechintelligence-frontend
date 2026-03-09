import { Badge } from "@/components/ui/badge"

export default function StatusSection({ status }: { status: string }) {

  if (!status) return null

  return (
    <div className="max-w-3xl mx-auto mt-6">
      {status === "processing" && (
        <Badge variant="secondary">Processing...</Badge>
      )}

      {status === "completed" && (
        <Badge variant="default">Completed</Badge>
      )}

      {status === "failed" && (
        <Badge variant="destructive">Failed</Badge>
      )}
    </div>
  )
}
