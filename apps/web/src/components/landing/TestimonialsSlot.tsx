import { SHOW_LANDING_TESTIMONIALS } from "@/lib/brand";

/**
 * Empty on purpose until real quotes exist. Hidden by default so fake reviews
 * never ship. Set SHOW_LANDING_TESTIMONIALS = true in brand.ts when ready.
 */
export function TestimonialsSlot() {
  if (!SHOW_LANDING_TESTIMONIALS) return null;

  return (
    <section className="landing-band" aria-label="Customer stories">
      <div className="landing-grid">
        <h2 className="landing-h2">From teams on Relay</h2>
        <div className="landing-testimonial-empty">
          <p>
            <strong>Add customer quote here</strong>
          </p>
          <p className="landing-muted">
            Placeholder only — replace with a real, permitted customer quote
            before enabling this section.
          </p>
        </div>
      </div>
    </section>
  );
}
