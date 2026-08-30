import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeGap } from '../../src/api/gap.js';
import { ApiError, postJson } from '../../src/api/client.js';

vi.mock('../../src/api/client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  postJson: vi.fn(),
}));

const snapshot = {
  reference_version: 'test.mapping.',
  professional_skills: [
    { skill: 'Python', skill_id: 's1', source: 'experience', evidence_type: 'literal' },
  ],
  reframed_skills: [{ skill: 'Coordination', skill_id: 's2', source: 'break' }],
  recommended_roles: [{ role: 'Software Developer', role_id: 'M251201' }],
};
const result = { readiness: 40, skills_have: ['Python'], gaps: [] };
beforeEach(() => {
  vi.clearAllMocks();
  postJson.mockResolvedValue(result);
});

describe('gap API contract', () => {
  it('preserves IDs, reference version and evidence while using the existing role choice', async () => {
    const controller = new AbortController();
    expect(await computeGap(snapshot, 'Software Developer', { signal: controller.signal })).toEqual(
      result
    );
    const [path, body, options] = postJson.mock.calls[0];
    expect(path).toBe('/api/gap/compute');
    expect(body.target_role_id).toBe('M251201');
    expect(body.target_role).toBe('Software Developer');
    expect(body.reference_version).toBe('test.mapping.');
    expect(body.skills.map((s) => s.skill_id)).toEqual(['s1', 's2']);
    expect(body.skills[0].evidence_type).toBe('literal');
    expect(options.signal).toBe(controller.signal);
  });

  it.each([404, 409])('returns the structured not-assessed body for HTTP %s', async (status) => {
    const body = {
      readiness: null,
      assessment_status: 'not_assessed',
      reason: 'role_not_eligible',
    };
    postJson.mockRejectedValue(new ApiError('role_not_eligible', status, body));
    expect(await computeGap(snapshot, 'Software Developer')).toBe(body);
  });

  it('does not swallow server errors', async () => {
    postJson.mockRejectedValue(new ApiError('Unavailable', 503));
    await expect(computeGap(snapshot, 'Software Developer')).rejects.toMatchObject({ status: 503 });
  });

  it('does not turn an unrelated HTTP 409 into an assessment', async () => {
    postJson.mockRejectedValue(new ApiError('Conflict', 409, { error: 'Conflict' }));
    await expect(computeGap(snapshot, 'Software Developer')).rejects.toMatchObject({ status: 409 });
  });

  it.each([null, {}, { readiness: null }, { readiness: 20 }])(
    'rejects malformed successful responses: %s',
    async (body) => {
      postJson.mockResolvedValue(body);
      await expect(computeGap(snapshot, 'Software Developer')).rejects.toThrow('could not be read');
    }
  );
});
