"use client";

import { Download, Linkedin, Github, Mail, Phone } from "lucide-react";
import { TextPage } from "@/components/text-page";
import styles from "./CVPage.module.css";
import dayjs from "dayjs";
import { cvCopy } from "@/content/cv";
import Image from "next/image";
import iponwebLogo from "../../public/iponweb.png";
import { HiddenField } from "@/components/HiddenField";
import { useAnalytics } from "@/components/PageViewAnalytics";

function formatPeriod(period: [Date, Date | null]): { display: string; duration: string } {
  const [start, end] = period;
  const startYear = start.getFullYear();
  const endYear = end ? end.getFullYear() : "Now";

  const endDate = end || new Date();
  const years = dayjs(endDate).diff(dayjs(start), "year");
  const months = dayjs(endDate).diff(dayjs(start), "month") % 12;

  let duration = "";
  if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""}`;
  if (months > 0) duration += `${years > 0 ? " " : ""}${months} mo`;

  return {
    display: `${startYear}\u00A0-\u00A0${endYear}`,
    duration: `(${duration})`,
  };
}

const OptionalLink: React.FC<{ href?: string; className?: string; children: React.ReactNode }> = ({
  href,
  className,
  children,
}) => {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
};

const JobLogo: React.FC<{ logo: string | React.ReactNode; alt: string }> = ({ logo, alt }) => {
  if (typeof logo === "string") {
    return <Image src={iponwebLogo} alt={alt} className="not-prose" />;
  }
  return <div className="w-full h-full flex items-center justify-center">{logo}</div>;
};

export function CVPage() {
  const analytics = useAnalytics();

  const handleDownloadPDF = async () => {
    // Track download event
    await analytics.trackEvent("resume.download");
    window.print();
  };

  const copy = cvCopy.default;

  // Calculate total experience
  // Find earliest start date
  const earliestStart = copy.experience.reduce(
    (earliest, job) => {
      const [start] = job.period;
      return !earliest || start < earliest ? start : earliest;
    },
    null as Date | null
  );

  // Calculate total time from earliest to now
  const totalMonths = earliestStart ? dayjs(new Date()).diff(dayjs(earliestStart), "month") : 0;

  // Subtract time with no role (Career Break)
  const breakMonths = copy.experience
    .filter(job => !job.role)
    .reduce((total, job) => {
      const [start, end] = job.period;
      const endDate = end || new Date();
      const months = dayjs(endDate).diff(dayjs(start), "month");
      return total + months;
    }, 0);

  const experienceYears = Math.floor((totalMonths - breakMonths) / 12);

  return (
    <div className={styles.cvContainer}>
      <TextPage className={`grow max-w-[800px] mx-6 my-8 ${styles.cvContent}`}>
        <div className={`mb-6 ${styles.headerSection}`}>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="!mb-1 !text-4xl">{copy.name}</h1>
              <p className="!mt-0 !mb-2 text-gray-600">{copy.location}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="print:hidden">
                  <HiddenField
                    eventName="resume.showEmail"
                    actualValue={
                      <a
                        href={`mailto:${copy.contact.email}`}
                        className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                      >
                        <Mail size={14} />
                        {copy.contact.email}
                      </a>
                    }
                    placeholder={
                      <>
                        <Mail size={14} />
                        Show email
                      </>
                    }
                  />
                </div>
                <a
                  href={`mailto:${copy.contact.email}`}
                  className="hidden print:flex text-gray-700 hover:text-gray-900 items-center gap-1"
                >
                  <Mail size={14} />
                  {copy.contact.email}
                </a>
                <div className="print:hidden">
                  <HiddenField
                    eventName="resume.showPhone"
                    actualValue={
                      <a
                        href={`tel:${copy.contact.phone.replace(/\./g, "")}`}
                        className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                      >
                        <Phone size={14} />
                        {copy.contact.phone}
                      </a>
                    }
                    placeholder={
                      <>
                        <Phone size={14} />
                        Show phone
                      </>
                    }
                  />
                </div>
                <a
                  href={`tel:${copy.contact.phone.replace(/\./g, "")}`}
                  className="hidden print:flex text-gray-700 hover:text-gray-900 items-center gap-1"
                >
                  <Phone size={14} />
                  {copy.contact.phone}
                </a>
                <a
                  href={copy.contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-gray-700 hover:text-gray-900 flex items-center gap-1 ${styles.linkedinLink}`}
                >
                  <Linkedin size={14} />
                  LinkedIn
                </a>
                <a
                  href={copy.contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                >
                  <Github size={14} />
                  <span className="print:hidden">Github</span>
                  <span className="hidden print:inline">Github: vklimontovich</span>
                </a>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className={`flex items-center gap-1 text-sm text-gray-600 underline md:no-underline md:px-4 md:py-2 md:bg-black md:text-white md:rounded-md md:hover:bg-gray-800 transition-colors md:flex-shrink-0 ${styles.downloadButton}`}
            >
              <Download size={14} className="md:w-4 md:h-4" />
              <span className="md:hidden">Save to PDF / Print</span>
              <span className="hidden md:inline">Download PDF</span>
            </button>
          </div>
        </div>

        <section className={`mb-6 ${styles.introSection}`}>
          <p className="text-gray-700 leading-relaxed">{copy.intro}</p>
        </section>

        <section className={`mb-6 ${styles.expertiseSection}`}>
          <h2>Professional Focus &amp; Expertise</h2>
          <hr />
          <ul className="space-y-1 mt-0">
            {copy.expertise.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 pt-4">{copy.expertise.closingSection}</p>
        </section>

        <section className="mb-6">
          <h2>
            Experience <span className="text-gray-500 font-normal text-base">({experienceYears} years)</span>
          </h2>
          <hr />
          <div className={`flex flex-col ${styles.exerienceList}`}>
            {copy.experience.map((job, idx) => {
              const { display, duration } = formatPeriod(job.period);
              return (
                <div key={idx} className={`last:mb-0 ${styles.experienceItem}`}>
                  <div className="flex gap-3 mb-2 items-start">
                    <div className="h-10 w-10 flex-shrink-0">
                      <OptionalLink href={job.url} className="block w-full h-full">
                        <JobLogo logo={job.logo} alt={job.company} />
                      </OptionalLink>
                    </div>
                    <div className="flex-grow flex justify-between items-baseline gap-2">
                      <div className="flex-1">
                        <div className={`flex flex-col md:block ${styles.jobTitle}`}>
                          {job.role && (
                            <>
                              <span className="font-semibold text-gray-900">{job.role}</span>
                              <span className={`text-gray-600 hidden md:inline ${styles.jobSeparator}`}> — </span>
                              {job.url ? (
                                <a
                                  href={job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  {job.company}
                                </a>
                              ) : (
                                <span className="text-gray-600">{job.company}</span>
                              )}
                            </>
                          )}
                          {!job.role &&
                            (job.url ? (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-gray-900 hover:text-gray-700"
                              >
                                {job.company}
                              </a>
                            ) : (
                              <span className="font-semibold text-gray-900">{job.company}</span>
                            ))}
                        </div>
                        <div className="text-gray-500 text-sm">{job.location}</div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <div className="font-bold text-base text-gray-900 whitespace-nowrap">{display}</div>
                        <div className="text-gray-500 text-sm whitespace-nowrap">{duration}</div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.jobDescription}>
                    {job.preamble && <p className={`text-gray-700`}>{job.preamble}</p>}
                    {job.highlights && (
                      <ul className="space-y-0 mt-0">
                        {job.highlights.map((highlight, hidx) => (
                          <li key={hidx}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <h2 className={styles.headerSection}>Education</h2>
          <hr />
          <ul className="space-y-1 mt-0">
            {copy.education.map((edu, idx) => (
              <li key={idx}>
                {edu.url ? (
                  <a
                    href={edu.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 no-underline hover:text-gray-900"
                  >
                    <b>{edu.institution}</b>
                  </a>
                ) : (
                  <b>{edu.institution}</b>
                )}
                , {edu.period}
              </li>
            ))}
          </ul>
        </section>
      </TextPage>
    </div>
  );
}
