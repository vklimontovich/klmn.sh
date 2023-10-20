import { ReactNode } from "react";
import styles from "./inline-highlight.module.css";
import Link from "next/link";
import clsx from "clsx";

interface InlineHighlightProps {
  href?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const InlineHighlight: React.FC<InlineHighlightProps> = p => {
  const internal = (
    <span className={clsx(styles.highlight, p.className)}>
      {p.icon && <span className={`${styles.iconAnimation} mr-1 w-3 h-3`}>{p.icon}</span>}
      {p.children}
    </span>
  );
  if (p.href) {
    return (
      <Link href={p.href} className="no-underline">
        {internal}
      </Link>
    );
  }
  return internal;
};
