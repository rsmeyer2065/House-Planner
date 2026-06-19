export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🏡</span>
            <h1 className="text-2xl font-bold text-foreground">Home Planner</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage your home together
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
