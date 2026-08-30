// @ts-check

/**
 * @typedef {Object} Experience
 * @property {string} title
 * @property {string} organisation
 * @property {string} start
 * @property {string} end
 * @property {string} description
 */

/**
 * @typedef {Object} StructuredCv
 * @property {string} raw_text
 * @property {Experience[]} experiences
 * @property {string[]} skill_mentions
 */

/**
 * @typedef {Object} ProfessionalSkill
 * @property {string} skill
 * @property {string | null} [skill_id]
 * @property {'experience'} source
 * @property {string} evidence
 * @property {'literal' | 'inferred' | 'semantic'} [evidence_type]
 * @property {boolean} [confirmed]
 */

/**
 * @typedef {Object} ReframedSkill
 * @property {string} skill
 * @property {string} [skill_id]
 * @property {'break'} source
 * @property {string} from_activity
 */

/**
 * @typedef {Object} PreviousOccupation
 * @property {string} role
 * @property {number | null} confidence
 * @property {'classifier' | 'embedding' | 'cv_title'} method
 */

/**
 * @typedef {Object} RecommendedRole
 * @property {string} role
 * @property {string} [role_id]
 * @property {string} [masco_code]
 * @property {string | null} [esco_code]
 * @property {number | null} similarity
 * @property {'exact_title' | 'title_variant' | 'embedding'} [method]
 */

/**
 * @typedef {Object} Snapshot
 * @property {ProfessionalSkill[]} professional_skills
 * @property {ReframedSkill[]} reframed_skills
 * @property {PreviousOccupation | null} previous_occupation
 * @property {RecommendedRole[]} recommended_roles
 * @property {string} [reference_version]
 * @property {string[]} [warnings]
 */

/**
 * @typedef {Object} Gap
 * @property {string} skill
 * @property {string} [skill_id]
 * @property {'role' | 'ai_digital'} band
 * @property {number} importance
 * @property {number} uplift
 */

/**
 * @typedef {Object} GapResult
 * @property {number | null} readiness
 * @property {'assessed' | 'not_assessed'} [assessment_status]
 * @property {string | null} [reason]
 * @property {number} [required_skill_count]
 * @property {number} [matched_skill_count]
 * @property {number} [missing_skill_count]
 * @property {string[]} [warnings]
 * @property {string[]} skills_have
 * @property {Gap[]} gaps
 */

export {};
