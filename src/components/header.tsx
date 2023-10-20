import { createElement, ReactNode } from "react";

export type HeaderProps = { children: ReactNode; id: string; level: "h1" | "h2" | "h3" | "h4" | "h5" };
export const Header: React.FC<HeaderProps> = p => {
  return createElement(
    p.level,
    null,
    <span className="group relative">
      <a href={`#${p.id}`} className="no-underline">
        <span className="hidden group-hover:inline absolute -left-4 pr-3 text-zinc-300 hover:text-zinc-900">#</span>
      </a>
      {p.children}
    </span>
  );
};
