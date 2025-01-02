import { ReactNode } from "react";
import clsx from "clsx";

export const TextPage: React.FC<{ className?: string; children: ReactNode }> = p => {
  return (
    <article
      className={clsx(
        p.className,
        "prose prose-zinc prose-h1:text-2xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-bold prose-h3:text-lg prose-h3:font-bold"
      )}
    >
      {p.children}
    </article>
  );
};
