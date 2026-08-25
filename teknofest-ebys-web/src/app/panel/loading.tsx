export default function Yukleniyor() {
  return (
    <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-muted" />
        ))}
      </div>
    </main>
  );
}
