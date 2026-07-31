# MixParty

Application de playlist collaborative avec un frontend Next.js et une API Express/Socket.IO.

## Installation

```powershell
cd C:\Dev\MixParty
npm install
Copy-Item apps\api\.env.example apps\api\.env
npm run dev
```

Le frontend démarre généralement sur `http://localhost:3000` et l’API sur `http://localhost:4000`.

## Configuration YouTube

Ouvre `apps/api/.env` et renseigne :

```env
YOUTUBE_API_KEY=ta_cle_google
```

La création et la participation à une soirée fonctionnent sans cette clé. Seule la recherche YouTube en a besoin.

## Accès depuis un téléphone

Le frontend construit automatiquement l’URL de l’API avec le nom d’hôte ouvert dans le navigateur et le port `4000`. Lance le projet, puis ouvre l’adresse réseau affichée par Next.js, par exemple `http://192.168.1.21:3000`.

Si le pare-feu Windows le demande, autorise Node.js sur le réseau privé.
