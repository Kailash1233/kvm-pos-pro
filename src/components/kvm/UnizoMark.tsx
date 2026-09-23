/** The default Unizo mark, used until a shop uploads its own logo in Settings. */
export function UnizoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <clipPath id="unizo-mark-clip">
          <rect x="0" y="0" width="32" height="32" rx="7" />
        </clipPath>
      </defs>
      <g clipPath="url(#unizo-mark-clip)">
        <rect x="0" y="0" width="32" height="32" fill="#252f59" />
        <rect x="0" y="25" width="32" height="7" fill="#4f8cff" />
      </g>
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fontFamily="IBM Plex Sans, Arial, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#fafbfd"
      >
        U
      </text>
    </svg>
  );
}
