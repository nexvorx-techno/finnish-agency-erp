"use client";

import React from "react";

interface EqualizerLoaderProps {
  size?: "sm" | "md" | "lg";
}

export const EqualizerLoader: React.FC<EqualizerLoaderProps> = ({
  size = "md",
}) => {
  const dimensions =
    size === "sm"
      ? { container: "h-5 gap-1", bar: "w-1 h-5" }
      : size === "lg"
      ? { container: "h-12 gap-2", bar: "w-2 h-12" }
      : { container: "h-8 gap-1.5", bar: "w-1.5 h-8" };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-flex items-end ${dimensions.container}`}
    >
      <span className={`eq-bar ${dimensions.bar}`} />
      <span className={`eq-bar ${dimensions.bar}`} />
      <span className={`eq-bar ${dimensions.bar}`} />
      <span className={`eq-bar ${dimensions.bar}`} />
      <span className={`eq-bar ${dimensions.bar}`} />
      <span className={`eq-bar ${dimensions.bar}`} />
    </div>
  );
};
