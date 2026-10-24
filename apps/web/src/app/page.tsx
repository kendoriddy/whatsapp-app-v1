import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/brand";
import { MarketingNav } from "@/components/landing/MarketingNav";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { PlansCarousel } from "@/components/landing/PlansCarousel";
import {
  ControlSection,
  HeroSection,
  InboxSection,
  MerlinSection,
  NumberSection,
  OrdersSection,
  PaystackSection,
  StatementSection,
  TeamSection,
} from "@/components/landing/HomeSections";
import "./landing.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--landing-font",
});

const siteUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") ||
  "https://whatsapp-app-v1.vercel.app";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Sell in chat, together`,
  description:
    "Relay is the WhatsApp order desk for teams that sell in chat. Your whole team replies from one number, and customers pay on Paystack.",
  openGraph: {
    title: `${PRODUCT_NAME} — Sell in chat, together`,
    description:
      "Shared inbox, Merlin drafts, orders and Paystack payments — for teams that sell in chat.",
    url: siteUrl,
    siteName: PRODUCT_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} — Sell in chat, together`,
    description:
      "Shared inbox, Merlin drafts, orders and Paystack payments — for teams that sell in chat.",
  },
};

export default function LandingPage() {
  return (
    <div className={`landing ${dmSans.variable} ${dmSans.className}`}>
      <MarketingNav />
      <main>
        <HeroSection />
        <MerlinSection />
        <StatementSection />
        <InboxSection />
        <OrdersSection />
        <ControlSection />
        <PaystackSection />
        <TeamSection />
        <NumberSection />
        <PlansCarousel />
      </main>
      <MarketingFooter />
    </div>
  );
}
