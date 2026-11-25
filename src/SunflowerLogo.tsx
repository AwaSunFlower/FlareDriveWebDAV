import React, { useId } from "react";

interface SunflowerLogoProps {
  size?: number | string;
}

const SunflowerLogo: React.FC<SunflowerLogoProps> = ({ size = 34 }) => {
  const uid = useId().replace(/:/g, "");
  const petalMainId = `sfPetalMain-${uid}`;
  const petalBackId = `sfPetalBack-${uid}`;
  const centerSeedId = `sfCenterSeed-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient
          id={petalMainId}
          x1="32"
          y1="4"
          x2="32"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient
          id={petalBackId}
          x1="12"
          y1="12"
          x2="52"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <radialGradient id={centerSeedId} cx="42%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="65%" stopColor="#451A03" />
          <stop offset="100%" stopColor="#291002" />
        </radialGradient>
      </defs>
      <g transform="translate(32 32)">
        <g fill={`url(#${petalBackId})`} opacity="0.92">
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
            <ellipse
              key={`b-${deg}`}
              rx="5.4"
              ry="13.5"
              transform={`rotate(${deg}) translate(0 -17.5)`}
            />
          ))}
        </g>
        <g fill={`url(#${petalMainId})`}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse
              key={`f-${deg}`}
              rx="5.8"
              ry="14.5"
              transform={`rotate(${deg}) translate(0 -17)`}
            />
          ))}
        </g>
        <circle
          r="11.5"
          fill={`url(#${centerSeedId})`}
          stroke="#FEF3C7"
          strokeWidth="1.5"
        />
        <circle cx="-3.5" cy="-3.5" r="1.4" fill="#FDE68A" opacity="0.75" />
        <circle cx="3" cy="-4" r="1.1" fill="#FCD34D" opacity="0.55" />
        <circle cx="0.5" cy="1" r="1.3" fill="#F59E0B" opacity="0.48" />
        <circle cx="-4" cy="3" r="1.1" fill="#F59E0B" opacity="0.48" />
        <circle cx="4.2" cy="2.6" r="1.2" fill="#FCD34D" opacity="0.52" />
      </g>
    </svg>
  );
};

export default SunflowerLogo;
