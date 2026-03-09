import Dashboard from "@/pages/Dashboard"
import { Toaster } from "sonner"

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      <Dashboard />

      <Toaster
        position="top-right"
        richColors
        closeButton
      />

    </div>
  )
}
