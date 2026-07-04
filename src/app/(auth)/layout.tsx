export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-3xl font-black tracking-tight">
          Macro<span className="text-accent">Map</span>
        </div>
        <p className="mt-1 text-sm text-ink-faint">The community-driven macro & fitness platform</p>
      </div>
      {children}
    </main>
  );
}
