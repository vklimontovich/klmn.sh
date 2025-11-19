import { ReactNode } from "react";
import { Briefcase, CodeXml, MonitorCog, TreePalm } from "lucide-react";
import { GetIntentLogo, JitsuLogo } from "@/components/icons";

export const Kw: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <em className="cvKeyword">{children}</em>;
};

export type CvCopy = {
  name: string;
  location: string;
  shortDescription: string;
  contact: {
    email: string;
    phone: string;
    linkedin: string;
    github: string;
  };
  intro: ReactNode;
  expertise: {
    items: Array<ReactNode>;
    closingSection: ReactNode;
  };
  experience: Array<{
    company: string;
    role?: string;
    location: string;
    period: [Date, Date | null];
    preamble?: ReactNode;
    highlights?: ReactNode[];
    logo?: string | ReactNode;
    url?: string;
  }>;
  education: Array<{
    institution: string;
    period: string;
    url?: string;
  }>;
};

export const cvCopy: Record<string, CvCopy> = {
  default: {
    name: "Vladimir Klimontovich",
    location: "Brooklyn, NY (authorized to work in the US)",
    shortDescription: "Hands-on engineering leader with 20+ years building high-scale distributed systems and products. Founded two companies—one YC-backed, another scaled to $4M ARR.",
    contact: {
      email: "v@klmn.sh",
      phone: "929.266.9175",
      linkedin: "https://www.linkedin.com/in/klimontovich/",
      github: "https://github.com/vklimontovich",
    },
    intro: (
      <>
        Engineering leader and repeat founder with 20+ years building high-scale distributed systems and product engineering teams. Hands-on with code and 
        architecture, and experienced scaling orgs from early stage. Built systems handling 1M req/sec, grew a 
        startup to $4M ARR, and led distributed teams across. Two-time founder, including the Y Combinator–backed Jitsu (YC S20) and one exit.</>
    ),
    expertise: {
      items: [
        <>
          <b>AI:</b> Deep expertise in LLM internals and production AI agents. Built multiple <Kw>MCP</Kw> servers and agent
          systems and RAG-pipelines
        </>,
        <>
          <b>Technical Leadership and Architecture:</b> Scaled teams to 30+ engineers, architected distributed systems processing 1M+
          requests/second
        </>,
        <>
          <b>Product Engineering:</b> Full-stack development from UI to backend, ships complete features from concept to
          production
        </>,
        <>
          <b>Data Engineering:</b> Scaled customer data platforms and advertising networks processing billions of events
          with <Kw>BigQuery</Kw>, <Kw>Kafka</Kw>, <Kw>Hadoop</Kw>, <Kw>ClickHouse</Kw>
        </>,
        <>
          <b>Product Leadership:</b> Founded two profitable B2B SaaS companies—one <Kw>YC</Kw>-backed, one scaled to{" "}
          <Kw>$4M ARR</Kw>
        </>,
      ],
      closingSection: (
        <>
          <b>Skills</b>: <Kw>Engineering Management</Kw>, <Kw>System Architecture</Kw>, <Kw>Kubernetes</Kw>, <Kw>AWS</Kw>,{" "}
          <Kw>Terraform</Kw>, <Kw>TypeScript</Kw>, <Kw>Next.js</Kw>, <Kw>Python</Kw>, <Kw>Java</Kw>, <Kw>Go</Kw>, <Kw>ClickHouse</Kw>, <Kw>Postgres</Kw>
        </>
      ),
    },
    experience: [
      {
        company: "Independent Consulting",
        role: "AI Software Architect",
        location: "New York, NY",
        period: [new Date(2024, 11), null],
        preamble: <>Hands-on consulting for early-stage startups on technical architecture, infrastructure, and AI strategy</>,
        highlights: [
          <>
            Seed-stage company: Architected and deployed production <Kw>AWS</Kw> infrastructure (<Kw>Kubernetes</Kw>/<Kw>ArgoCD</Kw>/
            <Kw>Helm</Kw>), developed initial product UI in <Kw>Next.js</Kw>
          </>,
          <>
            Series A company: Defined AI strategy, built prototype <Kw>MCP</Kw> server, <Kw>RAG</Kw> pipeline, and <Kw>AI-Agent</Kw>{" "}
            architecture
          </>,
        ],
        logo: <MonitorCog className="w-full h-full" strokeWidth={1} />,
        url: "https://klmn.sh",
      },
      {
        company: "Jitsu (YC S20)",
        role: "Founder & CEO",
        location: "New York, NY",
        period: [new Date(2020, 2), null],
        preamble: (
          <>
            Open-source customer data platform processing billions of events. Customers include large Canadian bank,
            fast-growing US coffee chain, and financial data platforms
          </>
        ),
        highlights: [
          <>
            Raised $1.5M from <Kw>Y Combinator</Kw> and other investors, achieved profitability
          </>,
          <>
            Led lean engineering team and architected event processing platform from scratch with <Kw>Kafka</Kw>, <Kw>Go</Kw>, <Kw>ClickHouse</Kw> and <Kw>Typescript</Kw>
          </>,
          <>
            Built production <Kw>TypeScript</Kw>/<Kw>Next.js</Kw> frontend
          </>,
        ],
        logo: <JitsuLogo />,
        url: "https://jitsu.com",
      },
      {
        company: "Career Break",
        location: "Moscow, Russia",
        logo: <TreePalm  size={40} strokeWidth={1} className="text-gray-400" />,
        period: [new Date(2018, 5), new Date(2020, 1)],
        preamble: (
          <>
            Career break following GetIntent exit. Advised several startups part-time on system architecture and operations.
          </>
        ),
      },
      {
        company: "Getintent",
        role: "Founder & CTO",
        location: "New York, NY",
        period: [new Date(2013, 3), new Date(2018, 4)],
        preamble: <>Founded online ad-exchange, scaled to $4M ARR and successful exit</>,
        highlights: [
          <>Raised $1.4M across two rounds, grew company from zero to $4M ARR</>,
          <>
            Built entire platform from scratch: high-load ad-exchange system (<Kw>Java</Kw>/<Kw>ClickHouse</Kw>) handling 1M
            requests/second with real-time bidding and optimization
          </>,
          <>Scaled engineering team from zero to 25 engineers, established development processes and technical culture</>,
          <>
            Wore COO hat managing HR, Finance, and Sales departments alongside building product and leading engineering
          </>,
        ],
        logo: <GetIntentLogo />,
        url: "https://getintent.com",
      },
      {
        company: "Iponweb",
        role: "Engineering Lead",
        location: "Moscow, Russia",
        period: [new Date(2009, 0), new Date(2013, 2)],
        preamble: <>Led engineering teams building high-performance adtech platforms for external clients and internal products</>,
        highlights: [
          <>
            Built CTR prediction and reporting system for PulsePoint AdExchange based on <Kw>Apache Hadoop</Kw>
          </>,
          <>
            Built a matching optimization algorithm for eHarmony
          </>,
          <>
            Architected first version of internal DMP framework
          </>,
        ],
        logo: "/iponweb.png",
        url: "https://www.iponweb.com",
      },
      {
        company: "Various Companies",
        role: "Software Engineer",
        location: "Moscow, Russia",
        period: [new Date(2004, 0), new Date(2009, 11)],
        preamble: (
          <>
            Software engineering roles across multiple companies including founding engineer at IIKO (restaurant management
            software). Technology stack: Java, PHP, C, JavaScript
          </>
        ),
        logo: <CodeXml  size={40} strokeWidth={1} className="text-gray-400" />,
      },
    ],
    education: [
      {
        institution: "Y Combinator",
        period: "Summer 2020",
      },
      {
        institution: "Moscow State University (Mathematics)",
        period: "2003-2007",
      },
      {
        institution: "Moscow State School 57",
        period: "1999-2003",
        url: "https://en.wikipedia.org/wiki/Moscow_State_School_57",
      },
    ],
  },
};
