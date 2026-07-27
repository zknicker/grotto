import { signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('an Owner confirms the immutable address and permanently deletes a Server', async ({
    page,
}) => {
    const slug = 'codex-delete-smoke';
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Codex Delete Smoke');
    await page.getByLabel('Address').fill(slug);
    await page.getByRole('button', { name: 'Create Server' }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${slug}$`, 'u'));

    await page.getByRole('button', { name: 'Delete Server' }).click();
    await expect(page.getByText('Delete Codex Delete Smoke?')).toBeVisible();
    await expect(page.getByText(/offline machine/iu)).toBeVisible();
    const confirmation = page.getByLabel('Type the Server address to confirm');
    const deleteButton = page.getByRole('button', { name: 'Delete Server' }).last();
    await expect(deleteButton).toBeDisabled();
    await confirmation.fill(`/${slug}`);
    await expect(deleteButton).toBeDisabled();
    await confirmation.fill(slug);
    await expect(deleteButton).toBeEnabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Delete Server' }).click();
    await expect(page.getByLabel('Type the Server address to confirm')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Delete Server' }).last()).toBeDisabled();

    await page.getByLabel('Type the Server address to confirm').fill(slug);
    await page.getByRole('button', { name: 'Delete Server' }).last().click();
    await expect(page).toHaveURL(/\/s$/u);
    await expect(page.getByRole('link', { name: 'Codex Delete Smoke' })).toHaveCount(0);
});
