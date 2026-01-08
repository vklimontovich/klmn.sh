
export type Essay = {
  slug: string;
  title: string;
  notionId?: string;
  mdxFile?: string;
  subtitle: string;
  date: Date;
  soon?: boolean;
};

export const essays: Essay[] = [
  {
    slug: "claude-code-for-taxes",
    title: "Claude Code Did My Taxes",
    mdxFile: "essays/cloud-code-for-taxes.md",
    subtitle:
      "3 returns (Federal, NYS, NYC), joint filing, 2 Schedule Cs, LLC consulting income, SEP IRA optimization, " +
      "HSA, Child Care Credit, foreign accounts, W-2 + 1099. 2 hours, 5 attempts.",
    date: new Date("2025-01-08"),
  },
  {
    slug: "monthly-vs-annual",
    title: "Should I sell my SaaS-subscription monthly or annually?",
    notionId: "488731272a364f6d85ccf11e0c533ca9",
    subtitle: "When it makes sense to offer annual plans and when it doesn't",
    date: new Date("2024-05-12"),
  },
  {
    slug: "selling-to-startups",
    notionId: "2ceed377d2c94c3aacba38e234ab1799",
    title: "The Hidden Challenges of Selling to Startups",
    subtitle: "Why focusing too much on early-stage startups can be a bad idea",
    date: new Date("2024-05-12"),
  },
  {
    slug: "coss",
    title: "Will my favorite open-source last?",
    soon: true,
    subtitle: "The harsh reality of commercial open-source projects cycle",
    date: new Date("2024-05-12"),
  },
  {
    slug: "pivotitus",
    title: "Pivots are bad for startup industry",
    soon: true,
    subtitle: "How startups get infected with pivotitus and what are the consequences",
    date: new Date("2024-05-12"),
  },
];

/**
 * Can't use node assert as it could be called from edge runtime
 * where node assert is not available
 */
export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export type NotionEssay = Omit<Essay, "notionId" | "mdxFile"> & { notionId: string; mdxFile?: undefined };
export type MdxEssay = Omit<Essay, "notionId" | "mdxFile"> & { mdxFile: string; notionId?: undefined };

export function getEssay(props: any): NotionEssay | MdxEssay {
  const slug = props.params.slug;
  const essay = essays.find(e => e.slug === slug);
  assert(essay, `No essay found for slug ${slug}`);
  assert(!essay.soon, `Should not render a page for an essay that is marked as soon`);
  assert(essay.notionId || essay.mdxFile, `No notionId or mdxFile found for essay ${slug}`);
  return essay as NotionEssay | MdxEssay;
}
