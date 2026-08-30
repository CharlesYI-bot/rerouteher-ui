import { beforeEach, describe, expect, it } from 'vitest';
import { migrateSession, useIntakeStore } from '../../src/store/intakeStore.js';
import snapshot from '../../src/mocks/fixtures/snapshot.high-confidence.json';

const store = () => useIntakeStore.getState();

beforeEach(() => store().reset());

describe('intake store', () => {
  it('marks the CV as parsed when one is stored', () => {
    store().setCv({ fileName: 'cv.pdf', raw_text: '', experiences: [], skill_mentions: [] });
    expect(store().cvParsed).toBe(true);

    store().clearCv();
    expect(store().cv).toBeNull();
    expect(store().cvParsed).toBe(false);
  });

  it('toggles activities without duplicating them', () => {
    store().toggleActivity('care_household.cared_for_children');
    store().toggleActivity('care_household.ran_household');
    store().toggleActivity('care_household.cared_for_children');

    expect(store().break.activities).toEqual(['care_household.ran_household']);
  });

  it('requires at least one activity before generating a snapshot (duration 0 is valid)', () => {
    expect(store().canGenerateSnapshot()).toBe(false);

    store().setBreakDuration(3);
    expect(store().canGenerateSnapshot()).toBe(false); // a duration alone is not enough

    store().toggleActivity('care_household.cared_for_children');
    expect(store().canGenerateSnapshot()).toBe(true);

    // "Less than a year" (duration 0) with an activity is still valid
    store().setBreakDuration(0);
    expect(store().canGenerateSnapshot()).toBe(true);
  });

  it('defaults the target role to the first recommended role', () => {
    store().setSnapshot(snapshot);
    expect(store().selectedRole).toBe('Senior UX/UI Designer');
  });

  it('leaves the target role unset when nothing matched', () => {
    store().setSnapshot({ ...snapshot, previous_occupation: null, recommended_roles: [] });
    expect(store().selectedRole).toBeNull();
  });

  it('drops a stale gap result when the target role changes', () => {
    store().setGapResult({ readiness: 78, skills_have: [], gaps: [] });
    store().setSelectedRole('Digital Marketing');

    expect(store().gapResult).toBeNull();
  });

  it('persists the session under the shared storage key', () => {
    store().setBreakDuration(5);
    expect(localStorage.getItem('rerouteher.guestSession')).toContain('"duration_years":5');
  });

  it('invalidates old snapshot and gap data while preserving the uploaded CV and break answers', () => {
    const cv = { fileName: 'test.pdf', raw_text: 'synthetic' };
    const migrated = migrateSession({
      cv,
      cvParsed: true,
      break: { duration_years: 5, activities: ['A1'] },
      snapshot,
      selectedRole: 'Old Role',
      gapResult: { readiness: 100 },
    });
    expect(migrated.cv).toEqual(cv);
    expect(migrated.break.duration_years).toBe(5);
    expect(migrated.snapshot).toBeNull();
    expect(migrated.selectedRole).toBeNull();
    expect(migrated.gapResult).toBeNull();
  });

  it('invalidates downstream results when the CV or career-break evidence changes', () => {
    store().setSnapshot(snapshot);
    store().setGapResult({ readiness: 78 });
    store().setBreakDuration(2);
    expect(store().snapshot).toBeNull();
    expect(store().gapResult).toBeNull();
    store().setSnapshot(snapshot);
    store().setCv({ raw_text: 'new synthetic CV' });
    expect(store().snapshot).toBeNull();
  });
});
