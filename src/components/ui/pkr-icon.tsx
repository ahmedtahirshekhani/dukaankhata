export function PKRIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L6 8h4v8H6l6 6 6-6h-4V8h4L12 2Z" />
      <text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor">
        PKR
      </text>
    </svg>
  );
}
