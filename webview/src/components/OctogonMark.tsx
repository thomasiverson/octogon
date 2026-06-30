type Props = {
  className?: string;
};

/** The Octogon "versus" mark — an octagon ring with two opposing triangles. */
export function OctogonMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon
        points="21.7,16.02 16.02,21.7 7.98,21.7 2.3,16.02 2.3,7.98 7.98,2.3 16.02,2.3 21.7,7.98"
        strokeWidth={1.7}
      />
      <g fill="currentColor" stroke="none">
        <polygon points="6.8,8.3 11.1,12 6.8,15.7" />
        <polygon points="17.2,8.3 12.9,12 17.2,15.7" />
      </g>
    </svg>
  );
}
