/** A 24×24 reel. The tile takes its colour from the text around it and the reel is knocked out, so the page shows through in either theme. */
const REEL_PATH =
  "M6.4 0H17.6A6.4 6.4 0 0 1 24 6.4V17.6A6.4 6.4 0 0 1 17.6 24H6.4A6.4 6.4 0 0 1 0 17.6V6.4A6.4 6.4 0 0 1 6.4 0ZM4.8 12a7.2 7.2 0 1 0 14.4 0a7.2 7.2 0 1 0-14.4 0ZM11.1 12a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0-1.8 0ZM10.7 7.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM6.61 10.671a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM8.173 15.479a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM13.227 15.479a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM14.79 10.671a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0Z";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 24 24">
      <path d={REEL_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
