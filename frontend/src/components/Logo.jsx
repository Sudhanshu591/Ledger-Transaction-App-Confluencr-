// Brand mark: a coin with the rupee symbol.
export default function Logo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" strokeWidth="2.2" />
      <path d="M11 8.5h10M11 12.5h10M14.5 8.5c4.6 0 4.6 8 0 8H11l7 7" strokeWidth="2" />
    </svg>
  );
}
