import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Gap from '../../src/routes/Gap.jsx';
import OccupationLine from '../../src/components/snapshot/OccupationLine.jsx';
import { computeGap } from '../../src/api/gap.js';
import { useIntakeStore } from '../../src/store/intakeStore.js';

vi.mock('../../src/api/gap.js', () => ({ computeGap: vi.fn() }));

const snapshot = {
  reference_version: 'test.mapping.',
  professional_skills: [{ skill: 'Python', skill_id: 's1', source: 'experience' }],
  reframed_skills: [],
  previous_occupation: { role: 'Software Engineer', method: 'cv_title', confidence: null },
  recommended_roles: [
    { role: 'Software Developer', role_id: 'M251201', masco_code: '251201' },
    { role: 'IT Project Manager', role_id: 'M151122', masco_code: '151122' },
  ],
};
const result = {
  assessment_status: 'assessed',
  readiness: 40,
  skills_have: ['Python'],
  required_skill_count: 10,
  matched_skill_count: 1,
  missing_skill_count: 9,
  gaps: [
    { skill_id: 's2', skill: 'SQL', band: 'ai_digital', importance: 100, uplift: 10 },
    { skill_id: 's3', skill: 'Debug Software', band: 'role', importance: 100, uplift: 10 },
    { skill_id: 's4', skill: 'Project Management', band: 'role', importance: 100, uplift: 10 },
  ],
};
const store = () => useIntakeStore.getState();
function show(strict = false) {
  const page = (
    <MemoryRouter>
      <Gap />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

beforeEach(() => {
  vi.resetAllMocks();
  store().reset();
  store().setSnapshot(snapshot);
  computeGap.mockResolvedValue(result);
});
afterEach(cleanup);

describe('gap rendering regressions', () => {
  it('shows an explanation when no automatic role matched, without search or manual selection', () => {
    store().setSnapshot({ ...snapshot, recommended_roles: [] });
    show();
    expect(screen.getByRole('status')).toHaveTextContent('could not find a suitable target role');
    expect(computeGap).not.toHaveBeenCalled();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Working it out…')).not.toBeInTheDocument();
  });

  it('renders numeric readiness and uses full requirement counts', async () => {
    show();
    expect(await screen.findByRole('img', { name: '40% Ready today' })).toBeVisible();
    expect(screen.getByRole('button', { name: /You meet 1 of 10 requirements/ })).toBeVisible();
    expect(screen.getByText(/Showing 3 priority gaps out of 9/)).toBeVisible();
    expect(screen.queryByText('Working it out…')).not.toBeInTheDocument();
  });

  it('renders a genuine zero rather than hiding the gauge', async () => {
    computeGap.mockResolvedValue({
      ...result,
      readiness: 0,
      skills_have: [],
      matched_skill_count: 0,
    });
    show();
    expect(await screen.findByRole('img', { name: '0% Ready today' })).toBeVisible();
  });

  it('renders not-assessed evidence without a numeric gauge or fabricated gaps', async () => {
    computeGap.mockResolvedValue({
      readiness: null,
      assessment_status: 'not_assessed',
      reason: 'insufficient_skill_evidence',
      skills_have: [],
      gaps: [],
    });
    show();
    expect(await screen.findByRole('heading', { name: 'Readiness not assessed' })).toBeVisible();
    expect(screen.getByText(/not enough recognised skill evidence/)).toBeVisible();
    expect(screen.queryByRole('img', { name: /Ready today/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/covered on every skill/)).not.toBeInTheDocument();
  });

  it('handles unavailable roles and reference-version changes', async () => {
    computeGap.mockResolvedValue({
      readiness: null,
      assessment_status: 'not_assessed',
      reason: 'reference_version_changed',
    });
    show();
    expect(await screen.findByText(/reference data has changed/)).toBeVisible();
  });

  it('retries a failed request for the same role', async () => {
    computeGap.mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValueOnce(result);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary failure');
    fireEvent.click(screen.getByRole('button', { name: 'Retry assessment' }));
    expect(await screen.findByRole('img', { name: '40% Ready today' })).toBeVisible();
    expect(computeGap).toHaveBeenCalledTimes(2);
  });

  it('ignores an older response after switching the existing role choice', async () => {
    let finishOld;
    computeGap
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockResolvedValueOnce({ ...result, readiness: 60 });
    show();
    await waitFor(() => expect(computeGap).toHaveBeenCalledTimes(1));
    const oldSignal = computeGap.mock.calls[0][2].signal;
    act(() => store().setSelectedRole('IT Project Manager'));
    expect(await screen.findByRole('img', { name: '60% Ready today' })).toBeVisible();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finishOld({ ...result, readiness: 99 }));
    expect(screen.getByRole('img', { name: '60% Ready today' })).toBeVisible();
    expect(store().selectedRole).toBe('IT Project Manager');
  });

  it('still completes under StrictMode effect cleanup', async () => {
    show(true);
    expect(await screen.findByRole('img', { name: '40% Ready today' })).toBeVisible();
    expect(screen.queryByText('Working it out…')).not.toBeInTheDocument();
  });

  it('preserves an already computed result for the same snapshot', () => {
    store().setGapResult(result);
    show();
    expect(screen.getByRole('img', { name: '40% Ready today' })).toBeVisible();
    expect(computeGap).not.toHaveBeenCalled();
  });

  it('does not show the old result after a new snapshot arrives', async () => {
    store().setGapResult(result);
    show();
    computeGap.mockResolvedValue({ ...result, readiness: 60 });
    act(() => store().setSnapshot({ ...snapshot }));
    expect(await screen.findByRole('img', { name: '60% Ready today' })).toBeVisible();
  });

  it('does not label a CV-stated title with null confidence as a low-confidence match', () => {
    render(<OccupationLine occupation={snapshot.previous_occupation} />);
    expect(screen.getByText('Software Engineer')).toBeVisible();
    expect(screen.queryByText('Exploratory match')).not.toBeInTheDocument();
  });
});
