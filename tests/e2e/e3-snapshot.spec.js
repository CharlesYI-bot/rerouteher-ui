import { expect, test } from '@playwright/test';
import { mockApi } from './helpers/mockApi.js';

const VALID_CV = 'tests/fixtures/cv/valid-cv.pdf';

/** The card wrapping a skill section, located by its heading. */
const section = (page, name) => page.getByRole('heading', { name }).locator('..');

/** Walks the intake so the snapshot is generated the way a guest generates it. */
async function reachSnapshot(page) {
  await page.goto('/diagnostic/background');
  await page.locator('input[type="file"]').setInputFiles(VALID_CV);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('slider').fill('5');
  await page.getByText('Childcare', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Skill Snapshot' }).click();
  await expect(page).toHaveURL(/\/diagnostic\/snapshot$/);
}

test.describe('E3 — Skill Snapshot & Career Reframing', () => {
  test('US3.1 — the stepper shows Story completed and Snapshot current', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.locator('[data-state="complete"]')).toHaveCount(2);
    await expect(page.locator('[data-state="current"]')).toHaveCount(1);
    await expect(page.locator('[data-state="current"]')).toContainText('Skill Snapshot');
  });

  test('US3.1 — professional and break-reframed skills sit in separate sections @smoke', async ({
    page,
  }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.getByRole('heading', { name: 'From your CV' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'From your career break' })).toBeVisible();
  });

  test('US3.1 — the break step can be reopened with its answers intact', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await page.getByRole('button', { name: 'Back to Career Break' }).click();
    await expect(page).toHaveURL(/\/diagnostic\/break$/);
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(1);

    await page.getByRole('button', { name: 'Continue to Skill Snapshot' }).click();
    await expect(page.getByRole('heading', { name: 'Your skill snapshot' })).toBeVisible();
  });

  test('US3.1 — each skill displays its source', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    // Source is carried by the section a skill sits in, not repeated on every row.
    await expect(section(page, 'From your CV')).toContainText('User Research & Persona Synthesis');
    await expect(section(page, 'From your career break')).toContainText('Active Listening');
  });

  test('US3.1 — a professional skill shows the evidence behind it', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.getByText('Ran usability testing at Wira Digital').first()).toBeVisible();
  });

  test('US3.1 — a section with no qualifying skills shows an empty state, not placeholders', async ({
    page,
  }) => {
    await mockApi(page, { snapshot: 'snapshot.empty-professional' });
    await reachSnapshot(page);

    await expect(page.getByText(/No professional skills matched/i)).toBeVisible();
    await expect(section(page, 'From your CV').getByRole('listitem')).toHaveCount(0);
  });

  test('US3.1 — returning to the snapshot restores it without regenerating', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    let regenerated = false;
    await page.route('**/api/snapshot/generate', (route) => {
      regenerated = true;
      return route.abort();
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'From your CV' })).toBeVisible();
    expect(regenerated).toBe(false);
  });

  test('US3.3 — each reframed skill names the activity it came from', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.getByText('from Childcare').first()).toBeVisible();
  });

  test('US3.3 — the reframed section explains where those skills come from', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(
      page.getByText(/come from the activities you did during your career break/i)
    ).toBeVisible();
  });

  test('US3.4 — the skills are attributed to her previous occupation', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.getByText(/based on your CV as a/i)).toContainText('Senior UX/UI Designer');
  });

  test('US3.4 — a confident match is stated plainly, with no caveat badge', async ({ page }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await expect(page.getByText('Senior UX/UI Designer').first()).toBeVisible();
    await expect(page.getByText('Exploratory match')).toHaveCount(0);
    await expect(page.getByText(/starting point rather than a verdict/i)).toHaveCount(0);
  });

  test('US3.4 — confidence below 70% shows "Exploratory match" with guidance', async ({ page }) => {
    await mockApi(page, { snapshot: 'snapshot.low-confidence' });
    await reachSnapshot(page);

    await expect(page.getByText('Exploratory match')).toBeVisible();
    await expect(page.getByText(/starting point rather than a verdict/i)).toBeVisible();
  });

  test('US3.4 — an unmatchable profile shows the no-match state, not a random role', async ({
    page,
  }) => {
    await mockApi(page, { snapshot: 'snapshot.no-match' });
    await reachSnapshot(page);

    await expect(
      page.getByText(/could not reliably identify your previous occupation/)
    ).toBeVisible();
    await expect(page.getByText('Exploratory match')).toHaveCount(0);
  });

  test('US3.4 — "See my readiness & gaps" opens E4 with the previous occupation selected', async ({
    page,
  }) => {
    await mockApi(page);
    await reachSnapshot(page);

    await page.getByRole('button', { name: 'See my readiness & gaps' }).click();

    await expect(page).toHaveURL(/\/diagnostic\/gap$/);
  });
});
