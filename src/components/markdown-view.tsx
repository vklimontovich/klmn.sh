"use client";
import React from "react";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  const html = md.render(content);
  return (
    <div
      className="prose prose-zinc max-w-none prose-headings:font-heading prose-a:text-purple-700
        prose-a:no-underline hover:prose-a:text-purple-900 prose-a:font-medium
        prose-pre:bg-zinc-100 prose-pre:text-zinc-800 prose-code:text-zinc-800
        prose-code:before:content-none prose-code:after:content-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
