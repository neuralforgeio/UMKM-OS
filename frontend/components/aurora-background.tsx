// Latar ambient aurora UMKM OS (v1.3.0) — tiga blob gradien bergerak
// lambat + pola titik grid. Dekoratif murni: pointer-events-none,
// aria-hidden, dan intensitasnya jauh lebih lembut di tema terang.
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="aurora-1 absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-blue-600/15 to-indigo-600/10 blur-[130px] dark:from-blue-600/30 dark:to-indigo-600/20" />
      <div className="aurora-2 absolute top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-700/15 blur-[140px] dark:from-cyan-500/20 dark:to-blue-700/25" />
      <div className="aurora-1 absolute -bottom-40 right-10 h-[700px] w-[700px] rounded-full bg-gradient-to-tl from-indigo-800/15 via-purple-900/10 to-transparent blur-[150px] dark:from-indigo-800/30 dark:via-purple-900/20" />
      <div className="bg-grid-pattern absolute inset-0 opacity-30 dark:opacity-40" />
    </div>
  );
}
