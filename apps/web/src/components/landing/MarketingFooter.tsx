import Link from "next/link";
import { RelayLogo } from "./RelayLogo";

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-top">
        <div className="mkt-footer-brand">
          <RelayLogo />
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Get started ↓
          </Link>
        </div>
        <div className="mkt-footer-cols">
          <div className="mkt-footer-col">
            <h4>Product</h4>
            <a href="/#inbox">Shared inbox</a>
            <a href="/#merlin">Merlin</a>
            <a href="/#orders">Orders &amp; invoices</a>
            <a href="/#plans">Pricing</a>
          </div>
          <div className="mkt-footer-col">
            <h4>Company</h4>
            <a href="mailto:hello@getrelay.app">About</a>
            <a href="mailto:hello@getrelay.app">Contact</a>
          </div>
          <div className="mkt-footer-col">
            <h4>Use Relay</h4>
            <Link href="/login">Log In</Link>
            <Link href="/signup">Get started</Link>
          </div>
          <div className="mkt-footer-col">
            <h4>Need help?</h4>
            <a href="mailto:hello@getrelay.app">Help Center</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="mkt-footer-bottom">
        <div>
          <span>© 2026 Relay</span>
          {" · "}
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <div className="mkt-social" aria-label="Social links">
          <a href="#" aria-label="X (Twitter)">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="#" aria-label="YouTube">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
            </svg>
          </a>
          <a href="#" aria-label="Instagram">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm6.4-8.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM12 2.2c-2.7 0-3 .01-4.1.06-2.8.13-4.1 1.45-4.2 4.2-.05 1.1-.06 1.4-.06 4.1s.01 3 .06 4.1c.13 2.75 1.4 4.07 4.2 4.2 1.1.05 1.4.06 4.1.06s3-.01 4.1-.06c2.8-.13 4.07-1.45 4.2-4.2.05-1.1.06-1.4.06-4.1s-.01-3-.06-4.1c-.13-2.75-1.4-4.07-4.2-4.2-1.1-.05-1.4-.06-4.1-.06zm0 1.8c2.6 0 2.9.01 4 .06 1.9.09 2.8.98 2.9 2.9.05 1.1.06 1.3.06 3.9s-.01 2.8-.06 3.9c-.09 1.9-.98 2.8-2.9 2.9-1.1.05-1.3.06-4 .06s-2.9-.01-4-.06c-1.9-.09-2.8-.98-2.9-2.9-.05-1.1-.06-1.3-.06-3.9s.01-2.8.06-3.9c.09-1.9.98-2.8 2.9-2.9 1.1-.05 1.4-.06 4-.06z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
