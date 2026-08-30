import { isHighConfidence } from '../../lib/confidence.js';
import ConfidenceBadge from './ConfidenceBadge.jsx';

/**
 * Attribution for the skills below: the occupation her CV reads as. A weak read
 * carries a badge and guidance, since it decides which roles are offered later.
 */
export default function OccupationLine({ occupation }) {
  if (!occupation) {
    return (
      <p className="mt-2 text-sm text-ink-soft sm:text-base">
        Here is what you already bring. We could not reliably identify your previous occupation.
      </p>
    );
  }

  const exploratory =
    occupation.method !== 'cv_title' &&
    Number.isFinite(occupation.confidence) &&
    !isHighConfidence(occupation.confidence);

  return (
    <>
      <p className="mt-2 text-sm text-ink-soft sm:text-base">
        Here is what you already bring, based on your CV as a{' '}
        <strong className="font-semibold text-ink">{occupation.role}</strong>.
      </p>

      {exploratory && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <ConfidenceBadge confidence={occupation.confidence} />
          Treat this as a starting point rather than a verdict — you can switch between suggested
          roles on the next step.
        </p>
      )}
    </>
  );
}
