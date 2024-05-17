import { Essay } from "@/content";
import Link from "next/link";
import clsx from "clsx";

export const EssaysList: React.FC<{ essays: Essay[]; className?: string }> = ({ essays, className }) => {
  return (
    <div className={clsx("flex flex-col gap-5 mt-2")}>
      {essays.map(essay => (
        <Link
          href={`/essays/${essay.slug}`}
          aria-disabled={essay.soon}
          key={essay.slug}
          className={`relative flex flex-col gap-1 no-underline font-normal border border-zinc-300 border-dashed px-4 py-2 rounded  hover:scale-[1.01] transition-all duration-200 ${
            essay.soon ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {essay.soon && (
            <div className="absolute top-0 right-0 bg-zinc-300 text-zinc-600 text-xs px-2 py-1 rounded-bl rounded-tr">
              Soon
            </div>
          )}
          <span className={`font-extrabold text-blue-600`}>{essay.title}</span>
          <span className="text-zinc-600 text-sm">{essay.subtitle}</span>
        </Link>
      ))}
    </div>
  );
};
