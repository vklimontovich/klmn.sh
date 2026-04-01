import { prisma } from "@/lib/server/prisma";

export async function log(namespace: string, body: any) {
  console.log(`${new Date().toISOString()} [${namespace}] ${JSON.stringify(body, null, 2)}`);
  await prisma.log.create({
    data: {
      namespace,
      body,
    },
  });
}
