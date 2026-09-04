import React from 'react';

interface ChbdLogoProps {
  className?: string;
  size?: number;
}

export const ChbdLogo: React.FC<ChbdLogoProps> = ({ className = 'w-7 h-7', size }) => {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Что было дальше логотип"
    >
      <defs>
        <linearGradient id="chbd-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#835df7" />
          <stop offset="100%" stopColor="#673fe8" />
        </linearGradient>
        <linearGradient id="chbd-logo-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Purple Squircle container with iOS curvature */}
      <rect
        x="2"
        y="2"
        width="124"
        height="124"
        rx="34"
        ry="34"
        fill="url(#chbd-logo-grad)"
      />

      {/* Inner highlight rim */}
      <rect
        x="2"
        y="2"
        width="124"
        height="124"
        rx="34"
        ry="34"
        fill="none"
        stroke="url(#chbd-logo-highlight)"
        strokeWidth="2.5"
      />

      {/* Outlined Play Triangle with rounded corners */}
      <path
        d="M 34 43 C 34 40.5 36.8 38.8 39.2 40.2 L 67.8 62.4 C 69.8 63.9 69.8 67 67.8 68.5 L 39.2 90.7 C 36.8 92.1 34 90.4 34 87.9 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Three dots aligned to triangle tip */}
      <circle cx="79.5" cy="65.5" r="4.5" fill="#ffffff" />
      <circle cx="91.5" cy="65.5" r="4.5" fill="#ffffff" />
      <circle cx="103.5" cy="65.5" r="4.5" fill="#ffffff" />
    </svg>
  );
};
