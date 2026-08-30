import { expect, test } from '@playwright/test';
import { mockApi } from './helpers/mockApi.js';

const snapshot = {
  reference_version: 'test.mapping.',
  professional_skills: [
    { skill: 'Python', skill_id: 's1', source: 'experience', evidence_type: 'literal' },
  ],
  reframed_skills: [],
  previous_occupation: { role: 'Software Engineer', method: 'cv_title', confidence: null },
  recommended_roles: [
    {
      role: 'Software Developer',
      role_id: 'M251201',
      masco_code: '251201',
      esco_code: '2512.4',
      method: 'title_variant',
      similarity: null,
    },
  ],
};
const assessed = {
  assessment_status: 'assessed',
  readiness: 25,
  skills_have: ['Python'],
  required_skill_count: 12,
  matched_skill_count: 1,
  missing_skill_count: 11,
  gaps: [
    { skill_id: 's2', skill: 'SQL', band: 'role', importance: 100, uplift: 10 },
    { skill_id: 's3', skill: 'Debug Software', band: 'role', importance: 100, uplift: 10 },
    { skill_id: 's4', skill: 'Project Management', band: 'role', importance: 100, uplift: 10 },
  ],
};

async function reachGap(page, response = snapshot, gapHandler = null) {
  await mockApi(page);
  await page.route('**/api/snapshot/generate', (route) => route.fulfill({ json: response }));
  if (gapHandler) await page.route('**/api/gap/compute', gapHandler);
  await page.goto('/diagnostic/background');
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/cv/valid-cv.pdf');
  await page.getByRole('button', { name: /Continue to Career Break/ }).click();
  await page.getByRole('slider').fill('5');
  await page.getByText('Childcare', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Skill Snapshot' }).click();
  await page.getByRole('button', { name: 'See my readiness & gaps' }).click();
  await expect(page).toHaveURL(/\/diagnostic\/gap$/);
}

test('empty automatic recommendations explain why readiness is unavailable', async ({ page }) => {
  let gapCalls = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/gap/compute')) gapCalls += 1;
  });
  await reachGap(page, { ...snapshot, recommended_roles: [] });
  await expect(page.getByRole('status')).toContainText('could not find a suitable target role');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect(gapCalls).toBe(0);
});

for (const readiness of [25, 0]) {
  test(`automatic target renders ${readiness}% with canonical IDs and full counts`, async ({
    page,
  }) => {
    await reachGap(page, snapshot, (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        target_role_id: 'M251201',
        reference_version: 'test.mapping.',
        skills: [{ skill_id: 's1', evidence_type: 'literal' }],
      });
      return route.fulfill({ json: { ...assessed, readiness } });
    });
    await expect(page.getByRole('img', { name: `${readiness}% Ready today` })).toBeVisible();
    await expect(page.getByRole('button', { name: /You meet 1 of 12 requirements/ })).toBeVisible();
    await expect(page.getByText(/Showing 3 priority gaps out of 11/)).toBeVisible();
  });
}

test('HTTP 409 not-assessed renders explanation, never zero or a blank panel', async ({ page }) => {
  await reachGap(page, snapshot, (route) =>
    route.fulfill({
      status: 409,
      json: {
        assessment_status: 'not_assessed',
        reason: 'insufficient_skill_evidence',
        readiness: null,
        error: 'insufficient_skill_evidence',
      },
    })
  );
  await expect(page.getByRole('heading', { name: 'Readiness not assessed' })).toBeVisible();
  await expect(page.getByText(/not enough recognised skill evidence/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Ready today/ })).toHaveCount(0);
});
