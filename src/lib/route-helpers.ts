import { headers } from "next/headers";

function getPortForProtocol(protocol: string, port: string): string | null {
  const portNum = parseInt(port, 10);
  if ((protocol === "https" && portNum === 443) || (protocol === "http" && portNum === 80)) {
    return null;
  }
  return port;
}

export async function getOrigin(path?: string): Promise<string> {
  const headersList = await headers();

  const forwardedProto = headersList.get("x-forwarded-proto");
  const forwardedHost = headersList.get("x-forwarded-host");
  const forwardedPort = headersList.get("x-forwarded-port");

  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = forwardedHost || headersList.get("host");

  const port = forwardedPort && !host?.includes(":") ? getPortForProtocol(protocol, forwardedPort) : null;
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}://${host}${portSuffix}${path || ""}`;
}
