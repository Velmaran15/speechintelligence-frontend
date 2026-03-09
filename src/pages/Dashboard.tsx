import UploadCard from "@/components/UploadCard"

export default function Dashboard() {
  return (
    <div className="relative min-h-screen">

      {/* Subtle Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.05),transparent_70%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-20 space-y-16">

        {/* HERO */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Speech Intelligence
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            AI-powered transcription with speaker detection and multilingual translation.
          </p>
        </div>

        {/* MAIN CARD */}
        <UploadCard />

      </div>
    </div>
  )
}
