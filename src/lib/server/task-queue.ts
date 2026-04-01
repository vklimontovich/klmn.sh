import { prisma } from "@/lib/server/prisma";
import initServerLogging from "@/lib/server/server-log";

initServerLogging();

export async function submitTask(task: any, opts: { key?: string } = {}) {
  if (opts.key) {
    const deleted = await prisma.taskQueue.deleteMany({
      where: {
        key: opts.key,
      },
    });
    if (deleted.count > 0) {
      console.log(
        `Deleted ${deleted.count} tasks with key ${opts.key}, only one task with the same key can be submitted at a time`
      );
    }
  }

  await prisma.taskQueue.create({
    data: {
      key: opts?.key || null,
      task: task as any,
    },
  });
}

export type TaskHandler = (task: any, opts: { key?: string }) => Promise<void>;

export async function handleNextTask(handler: TaskHandler): Promise<boolean> {
  const task = await prisma.taskQueue.findFirst({
    where: {
      completedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!task) {
    return false;
  }
  try {
    await handler(task.task, { key: task.key || undefined });
    await prisma.taskQueue.update({
      where: {
        id: task.id,
      },
      data: {
        completedAt: new Date(),
      },
    });
  } catch (e: any) {
    await prisma.taskQueue.update({
      where: {
        id: task.id,
      },
      data: {
        error: e?.message,
        completedAt: new Date(),
      },
    });
    console.error("Error handling task", e);
  }
  return true;
}

export async function handleTaskQueue(handler: TaskHandler, opts: { maxTasks?: number } = {}) {
  let tasksHandled = 0;
  const tasks = await prisma.taskQueue.count({ where: { completedAt: null } });
  console.log(`Found ${tasks} tasks in queue${opts.maxTasks ? `, handling ${opts.maxTasks} tasks` : ""}`);
  while (true) {
    const hasMore = await handleNextTask(handler);
    if (!hasMore) {
      break;
    }
    tasksHandled++;
    console.log(`Handled ${tasksHandled} tasks`);
    if (opts.maxTasks !== undefined && tasksHandled >= opts.maxTasks) {
      console.log(`Exiting since maxTasks=${opts.maxTasks}`);
    }
  }
}
