import Link from "next/link";

export function RelayLogo() {
  return (
    <Link href="/" className="mkt-logo" aria-label="Relay home">
      <span className="mkt-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 12h10M11 6l6 6-6 6"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>Relay</span>
    </Link>
  );
}
