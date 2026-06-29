import { Heart } from 'lucide-react';

/**
 * Static, server-rendered credit line. Renders nothing in print.
 * Lives in the corner of every layout (auth + dashboard).
 */
export default function CreatorFooter() {
  return (
    <div
      className="creator-footer"
      role="contentinfo"
      aria-label="Creator credit"
    >
      <span>Built with</span>
      <Heart
        size={12}
        className="creator-footer-heart"
        aria-hidden="true"
        fill="currentColor"
      />
      <span>
        by <strong>Owais Majeed</strong>
      </span>
    </div>
  );
}