import { ApiError, postJson } from './client.js';

/**
 * @param {import('../types/api.js').Snapshot} snapshot
 * @param {string} targetRole
 * @returns {Promise<import('../types/api.js').GapResult>}
 */
export async function computeGap(snapshot, targetRole, options = {}) {
  const skills = [...snapshot.professional_skills, ...snapshot.reframed_skills].map(
    ({ skill, skill_id, source, evidence_type, confirmed }) => ({
      skill,
      skill_id,
      source,
      evidence_type,
      confirmed,
    })
  );
  const role = snapshot.recommended_roles.find((candidate) => candidate.role === targetRole);
  try {
    const result = await postJson(
      '/api/gap/compute',
      {
        skills,
        target_role: targetRole,
        target_role_id: role?.role_id,
        reference_version: snapshot.reference_version,
      },
      options
    );
    if (
      !result ||
      (result.assessment_status !== 'not_assessed' &&
        (!Number.isFinite(result.readiness) ||
          !Array.isArray(result.gaps) ||
          !Array.isArray(result.skills_have)))
    ) {
      throw new ApiError('The assessment response could not be read. Please retry.', 200);
    }
    return result;
  } catch (error) {
    if ([404, 409].includes(error.status) && error.data?.assessment_status === 'not_assessed') {
      return error.data;
    }
    throw error;
  }
}
