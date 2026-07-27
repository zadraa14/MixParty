"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinPage() {

  const router = useRouter();
  const params = useParams();

  const code = params.code as string;


  useEffect(() => {

    if (code) {

      router.push(`/party/${code}`);

    }

  }, [code, router]);


  return (

    <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">

      <p>
        Connexion à la soirée...
      </p>

    </main>

  );

}