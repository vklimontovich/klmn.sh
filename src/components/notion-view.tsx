"use client";
import { ExtendedRecordMap } from "notion-types";
import React from "react";
import clsx from "clsx";
import "react-notion-x/src/styles.css";
import "./notion-view.css";
import { NotionRenderer } from "react-notion-x";

export const NotionView: React.FC<{ data: ExtendedRecordMap }> = ({ data }) => {
  return (
    <NotionRenderer
      className={clsx("max-w-none notion-full-width w-unset p-unset spa")}
      recordMap={data}
    />
  );
};
