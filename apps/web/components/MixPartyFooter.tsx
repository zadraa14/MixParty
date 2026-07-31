export default function MixPartyFooter() {
  return (
    <footer className="hidden flex-col items-center justify-between gap-3 border-t border-white/[0.07] py-6 text-sm text-white/30 sm:flex sm:flex-row">
      <p>MixParty — La playlist collaborative de tes soirées.</p>
      <div className="flex items-center gap-5">
        <span>Musique</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Votes</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Ambiance</span>
      </div>
    </footer>
  );
}
