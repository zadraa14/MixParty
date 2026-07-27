export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-xl">

        <h1 className="text-6xl font-bold mb-6">
          🎵 MixParty
        </h1>

        <p className="text-xl text-gray-300 mb-10">
          La playlist collaborative de vos soirées.
          <br />
          Une seule playlist, tous les amis aux commandes.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row justify-center">

          <a
  href="/create"
  className="bg-[#1DB954] hover:opacity-90 text-black font-bold px-8 py-4 rounded-full"
>
  🎉 Créer une soirée
</a>

          <button className="bg-[#8B5CF6] hover:opacity-90 text-white font-bold px-8 py-4 rounded-full">
            📱 Rejoindre une soirée
          </button>

        </div>

      </div>
    </main>
  );
}