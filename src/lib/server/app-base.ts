function sanitize(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  while (url.endsWith("/")) {
    url = url.substring(0, url.length - 1);
  }
  return url;
}

export const applicationHost = sanitize(process.env.APPLICATION_URL || process.env.VERCEL_URL || "http://localhost:6401");