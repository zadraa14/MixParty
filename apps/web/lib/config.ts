const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

/**
 * Les appels HTTP passent par une route Next.js interne sur le port 3000.
 * Le téléphone n'a donc jamais besoin d'accéder directement au port 4000.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/mixparty-api`;
  }

  return "http://localhost:3000/mixparty-api";
}

/**
 * Socket.IO reste connecté directement à l'API. Une panne de Socket.IO
 * n'empêche pas le chargement initial de la soirée.
 */
export function getSocketUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (configuredUrl) return trimTrailingSlash(configuredUrl);

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://localhost:4000";
}

export function getSocketPath(): string {
  return "/socket.io";
}

export function getAppBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}
