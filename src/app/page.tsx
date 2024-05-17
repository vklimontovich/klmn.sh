import { InlineHighlight } from "@/components/inline-highlight";
import {
  FacebookLogo,
  GetIntentLogo,
  GithubLogo,
  JitsuLogo,
  LinkedInLogo,
  TelegramLogo,
  TwitterLogo,
  YCombinatorLogo,
} from "@/components/icons";
import { Header } from "@/components/header";
import Link from "next/link";
import Image from "next/image";
import headshot from "@/assets/headshot.jpg";
import { TextPage } from "@/components/text-page";
import { Mail, MapPin } from "lucide-react";
import { ReactNode } from "react";
import clsx from "clsx";
import { essays } from "@/content";
import { EssaysList } from "@/components/essays-list";

const AvatarLink: React.FC<{ href?: string; className?: string; children: ReactNode; icon: ReactNode }> = ({
  href,
  children,
  icon,
  ...p
}) => {
  const content = (
    <div className={clsx("flex items-center flex-nowrap text-sm text-zinc-600 group", p.className)}>
      <span className="h-4 w-4 group-hover:text-zinc-900 group-hover:scale-105">{icon}</span>
      <span className="ml-1 whitespace-nowrap">{children}</span>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col md:flex-row md:items-start justify-start md:justify-center py-10 md:py-16 px-6 md:px-12">
      <section className="shrink md:mr-6 flex flex-col items-center md:items-start min-w-fit">
        <Link href={"/"}>
          <Image src={headshot} alt="photo" className="rounded-full h-24 w-24 md:h-32 md:w-32" />
        </Link>

        <section className="flex flex-col items-center md:items-start">
          <AvatarLink className="mt-6" icon={<MapPin className="h-full w-full" />}>
            New York
          </AvatarLink>
          <div className="flex flex-row md:flex-col flex-wrap justify-center gap-4 md:gap-2 mt-6 mb-6">
            <AvatarLink icon={<JitsuLogo mono={true} />} href="https://jitsu.com">
              Jitsu
            </AvatarLink>
            <AvatarLink icon={<TwitterLogo mono={true} />} href="https://twitter.com/vl_klmn">
              vl_klmn
            </AvatarLink>
            <AvatarLink icon={<GithubLogo mono={true} />} href="https://github.com/vklimontovich">
              vklimontovich
            </AvatarLink>
            <AvatarLink icon={<TelegramLogo mono={true} />} href="https://t.me/v_klmn">
              v_klmn
            </AvatarLink>
            <AvatarLink
              icon={
                <div className="flex bg-current h-full w-full rounded-full justify-center items-center">
                  <Mail className="text-white" style={{ height: "60%", width: "60%" }} />
                </div>
              }
              href="mailto:v@klmn.io"
            >
              v@klmn.io
            </AvatarLink>
          </div>
        </section>
      </section>

      <TextPage className="">
        <h1>
          Hi, I{"'"}m <span className="whitespace-nowrap">Vladimir Klimontovich 👋</span>
        </h1>
        <p>
          I{"'"}m a tech entrepreneur and product engineer. Currently, I{"'"}m founder and CEO of
          <InlineHighlight href="https://jitsu.com" icon={<JitsuLogo />}>
            Jitsu
          </InlineHighlight>{" "}
          (YC S20). Before I was a co-founder of{" "}
          <InlineHighlight href={"https://getintent.com"} icon={<GetIntentLogo />}>
            GetIntent
          </InlineHighlight>{" "}
          (acquired). I{"'"}m passionate about data, analytics and building products. You can reach me at{" "}
          <InlineHighlight>v@klmn.io</InlineHighlight>
        </p>
        I maintain some social media presence:{" "}
        <InlineHighlight href="https://twitter.com/vklimontovich" icon={<TwitterLogo />}>
          vl_klmn
        </InlineHighlight>
        ,{" "}
        <InlineHighlight href="https://www.linkedin.com/in/klimontovich/" icon={<LinkedInLogo />}>
          Linked In
        </InlineHighlight>
        ,{" "}
        <InlineHighlight href="https://facebook.com/klimontovich" icon={<FacebookLogo />}>
          Facebook
        </InlineHighlight>
        . I write about startups and tech on{" "}
        <InlineHighlight href="https://t.me/termsheet" icon={<TelegramLogo />}>
          Telegram
        </InlineHighlight>{" "}
        in Russian
        <Header id="jitsu" level="h2">
          About Jitsu
        </Header>
        <p>
          <InlineHighlight href="https://jitsu.com" icon={<JitsuLogo />}>
            Jitsu
          </InlineHighlight>{" "}
          is an open-source tool for capturing customer data and saving it to data warehouses. Customer data can be
          either streamed from apps, or pulled from external services with{" "}
          <Link href="https://jitsu.com/integrations/connectors">Jitsu Connectors</Link>.
        </p>
        <p>
          We{"'"}re VC-backed by{" "}
          <InlineHighlight href="https://ycombinator.com" icon={<YCombinatorLogo />}>
            Y Combinator
          </InlineHighlight>
          , <InlineHighlight href="https://costanoa.vc/">Costanoa Ventures</InlineHighlight> and few other investors.
        </p>
        <Header id="jitsu" level="h2">
          About GetIntent
        </Header>
        <p>
          <InlineHighlight href={"https://getintent.com"} icon={<GetIntentLogo />}>
            GetIntent
          </InlineHighlight>{" "}
          is (was?) an online advertising platform for buying ads from{" "}
          <Link href="https://en.wikipedia.org/wiki/Real-time_bidding">real-time online auctions (aka RTB)</Link>
        </p>
        <p>
          I co-founded GetIntent in 2013 and was a CTO, and later COO until 2018 when I left. The company was acquired
          in 2019.
        </p>
        <Header id="essays" level="h2">
          Essays
        </Header>
        <p>Sometimes I write about startups, and other things:</p>
        <EssaysList className="mt-2" essays={essays} />
      </TextPage>
    </main>
  );
}
