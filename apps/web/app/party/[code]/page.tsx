"use client";

import { useState, use } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function PartyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
const { code } = use(params);
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("😀");
const [participants, setParticipants] = useState<
  { nickname: string; avatar: string }[]
>([]);
  const [songs, setSongs] = useState<
  { title: string; votes: number }[]
>([]);
  const [song, setSong] = useState("");

  if (!joined) {
    return (
      <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-6">

        <div className="max-w-md w-full text-center">

          <h1 className="text-4xl font-bold mb-6">
            🎉 Rejoindre MixParty
          </h1>
<div className="bg-[#18181B] rounded-2xl p-6 mb-6 text-center">

  <h2 className="text-xl font-bold mb-4">
    📱 Invite tes amis
  </h2>

  <div className="flex justify-center">
    <QRCodeCanvas
      value={`http://localhost:3000/party/${code}`}
      size={200}
    />
  </div>

  <p className="mt-4 text-gray-400">
    Code : {code}
  </p>

</div>
          <p className="text-gray-400 mb-6">
            Code : {code}
          </p>

          <input
            className="w-full bg-[#18181B] rounded-xl p-4 mb-4"
            placeholder="Ton pseudo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <div className="flex justify-center gap-4 text-3xl mb-6">
            {["😀", "😎", "🎧", "🔥"].map((item) => (
              <button
                key={item}
                onClick={() => setAvatar(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button
  onClick={() => {
    setParticipants([
      ...participants,
      {
        nickname,
        avatar,
      },
    ]);

    setJoined(true);
  }}
  disabled={!nickname}
  className="bg-[#1DB954] text-black font-bold px-8 py-4 rounded-full"
>
  Rejoindre la soirée
</button>

        </div>

      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#09090B] text-white p-8">

      <div className="max-w-xl mx-auto">

        <h1 className="text-4xl font-bold mb-6">
          🎉 Soirée MixParty
        </h1>


        <div className="bg-[#18181B] rounded-2xl p-6 mb-6">

          <h2 className="text-xl mb-3">
  👥 Participants
</h2>

<div>
  {participants.map((person, index) => (
    <p
      key={index}
      className="text-xl mb-2"
    >
      {person.avatar} {person.nickname}
    </p>
  ))}
</div>

        </div>


        <div className="bg-[#18181B] rounded-2xl p-6 mb-6">

          <h2 className="text-2xl font-bold mb-4">
            🎵 Ajouter un morceau
          </h2>


          <input
            className="w-full bg-black rounded-xl p-4 mb-4"
            placeholder="Nom du morceau"
            value={song}
            onChange={(e) => setSong(e.target.value)}
          />


          <button
            onClick={() => {
              if (song) {
                setSongs([
  ...songs,
  {
    title: song,
    votes: 0,
  },
]);
                setSong("");
              }
            }}
            className="bg-[#1DB954] text-black font-bold px-6 py-3 rounded-full"
          >
            Ajouter
          </button>

        </div>


        <div className="bg-[#18181B] rounded-2xl p-6">

          <h2 className="text-2xl font-bold mb-4">
            🎶 File d'attente
          </h2>


          {songs.length === 0 && (
            <p className="text-gray-400">
              Aucun morceau ajouté
            </p>
          )}


       {songs.map((item, index) => (
  <div
    key={index}
    className="flex justify-between items-center bg-black rounded-xl p-4 mb-3"
  >

    <div>
      <p className="font-bold">
        {index + 1}. {item.title}
      </p>

      <p className="text-gray-400">
        👍 {item.votes} votes
      </p>
    </div>


    <button
      onClick={() => {
        const updatedSongs = songs.map((song, i) =>
          i === index
            ? {
                ...song,
                votes: song.votes + 1,
              }
            : song
        );

        setSongs(updatedSongs);
      }}
      className="bg-[#8B5CF6] px-4 py-2 rounded-full font-bold"
    >
      👍 Voter
    </button>

  </div>
))}
        </div>

      </div>

    </main>
  );
}