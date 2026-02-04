import React from "react";

export default function BrainLogo({ size = 40, src = "/favicon.png" }) {
  return (
    <img
      src={src}
      alt="Logo"
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
