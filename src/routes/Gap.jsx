import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Header from '../components/layout/Header.jsx';
import GlassCard from '../components/ui/GlassCard.jsx';
import IntakeStepper from '../components/intake/IntakeStepper.jsx';
import BackLink from '../components/intake/BackLink.jsx';
import ReadinessGauge from '../components/gap/ReadinessGauge.jsx';
import RoleSelector from '../components/gap/RoleSelector.jsx';
import MetRequirements from '../components/gap/MetRequirements.jsx';
import FocusAreaList, { MAX_FOCUS_AREAS } from '../components/gap/FocusAreaList.jsx';
import { computeGap } from '../api/gap.js';
import { useIntakeStore } from '../store/intakeStore.js';

export default function Gap() {
  const snapshot = useIntakeStore((state) => state.snapshot);
  const selectedRole = useIntakeStore((state) => state.selectedRole);
  const gapResult = useIntakeStore((state) => state.gapResult);
  const setSelectedRole = useIntakeStore((state) => state.setSelectedRole);
  const setGapResult = useIntakeStore((state) => state.setGapResult);

  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const error =
    failure?.snapshot === snapshot && failure?.role === selectedRole && failure?.attempt === attempt
      ? failure.message
      : null;
  const computing = Boolean(snapshot && selectedRole && !gapResult && !error);

  useEffect(() => {
    if (!snapshot || !selectedRole || gapResult) return;
    const controller = new AbortController();
    let active = true;
    computeGap(snapshot, selectedRole, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setGapResult(result);
      })
      .catch((cause) => {
        if (!active) return;
        if (cause.name !== 'AbortError')
          setFailure({ snapshot, role: selectedRole, attempt, message: cause.message });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [snapshot, selectedRole, gapResult, setGapResult, attempt]);

  if (!snapshot) return <Navigate to="/diagnostic/background" replace />;

  const assessed =
    gapResult &&
    gapResult.assessment_status !== 'not_assessed' &&
    Number.isFinite(gapResult.readiness);
  const requiredCount =
    gapResult?.required_skill_count ??
    (gapResult?.skills_have?.length ?? 0) + (gapResult?.gaps?.length ?? 0);
  const projected =
    assessed &&
    Math.round(
      (gapResult.readiness +
        gapResult.gaps.slice(0, MAX_FOCUS_AREAS).reduce((sum, gap) => sum + gap.uplift, 0)) *
        100
    ) / 100;

  const reasons = {
    insufficient_skill_evidence:
      'There is not enough recognised skill evidence to calculate readiness. Please check your CV in the earlier steps.',
    role_not_eligible:
      'This suggested role is not currently available for assessment. Return to your snapshot to refresh the suggestions.',
    no_approved_requirements: 'This role does not yet have approved requirements to assess.',
    invalid_requirement_profile: 'The role requirements cannot currently be assessed.',
    invalid_ai_exposure: 'This role is missing information needed to calculate readiness.',
    unknown_role:
      'This role is no longer available. Return to your snapshot to refresh the suggestions.',
    ambiguous_role_title:
      'This role could not be identified reliably. Return to your snapshot to refresh the suggestions.',
    reference_version_changed:
      'The reference data has changed. Please regenerate your skill snapshot before assessing readiness.',
  };

  return (
    <div className="flex min-h-screen flex-col bg-grad-page">
      <Header />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-8 sm:px-6">
        <IntakeStepper currentIndex={3} />

        <div className="mt-8">
          <BackLink to="/diagnostic/snapshot">Back to Skill Snapshot</BackLink>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">
          Where do you want to go next?
        </h1>

        <div className="mt-5">
          <RoleSelector
            roles={snapshot.recommended_roles}
            selected={selectedRole}
            onSelect={setSelectedRole}
            disabled={computing}
          />
        </div>

        {!selectedRole && (
          <p
            role="status"
            className="mt-5 rounded-2xl border border-ink-faint/20 bg-white/60 p-5 text-sm text-ink-soft"
          >
            We could not find a suitable target role from this CV, so readiness has not been
            assessed. Return to your skill snapshot and check your uploaded CV.
          </p>
        )}

        {error && (
          <div role="alert" className="mt-4 text-sm font-medium text-pink-600">
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry assessment
            </button>
          </div>
        )}

        {gapResult && !assessed && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-ink-faint/20 bg-white/60 p-5"
          >
            <h2 className="font-display text-lg font-bold text-ink">Readiness not assessed</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {reasons[gapResult.reason] ??
                'We could not calculate a reliable assessment from the available information.'}
            </p>
          </div>
        )}

        {assessed && (
          /* The score is a narrow summary rail; the focus areas are the work, so
             they take the dominant column. */
          <div className="mt-5 grid items-start gap-5 md:grid-cols-[19rem_1fr]">
            <GlassCard className="p-6">
              <h2 className="font-display text-lg font-bold text-ink">{selectedRole}</h2>

              <div className="mt-3">
                <ReadinessGauge value={gapResult.readiness} />
              </div>

              {projected > gapResult.readiness && (
                <p className="mt-3 inline-flex rounded-full bg-pink-100 px-3 py-1.5 text-sm font-semibold text-pink-600">
                  {gapResult.readiness}% today → {projected}% after your focus areas
                </p>
              )}

              <div className="mt-5 border-t border-ink-faint/15 pt-4">
                <MetRequirements
                  skills={gapResult.skills_have}
                  total={requiredCount}
                  matched={gapResult.matched_skill_count ?? gapResult.skills_have.length}
                />
              </div>

              {gapResult.warnings?.some((warning) => warning.includes('band_missing')) && (
                <p className="mt-4 text-xs text-ink-soft">
                  One requirement band is missing from the reference data. This score covers only
                  the available band.
                </p>
              )}
              <p className="mt-4 text-xs text-ink-soft">
                Readiness weighs each required skill by how much the role depends on it, so it is
                not a plain count of skills covered.
              </p>
            </GlassCard>

            <FocusAreaList
              gaps={gapResult.gaps}
              totalMissing={gapResult.missing_skill_count ?? gapResult.gaps.length}
            />
          </div>
        )}

        {computing && selectedRole && !gapResult && (
          <p className="mt-6 text-sm text-ink-soft">Working it out…</p>
        )}
      </main>
    </div>
  );
}
