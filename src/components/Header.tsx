
export default function Header() {
  return (
    <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center text-white font-semibold">
            SI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Speech Intelligence
          </h1>
        </div>

      </div>
    </header>
  )
}

