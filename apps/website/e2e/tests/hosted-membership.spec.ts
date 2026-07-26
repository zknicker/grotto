import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

/**
 * The membership round trip in a real browser: an Owner invites, a second Clerk
 * identity accepts and lands in #all, the Owner promotes and then removes them,
 * and the removed human loses the Server. The last Owner stays protected
 * throughout.
 */
const slug = 'membership-hq';

test('an Owner invites, promotes, and removes a human', async ({ browser, page }) => {
    const { peerEmail } = readClerkSessionFixture();

    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Membership HQ');
    await page.getByLabel('Address').fill(slug);
    await page.getByRole('button', { name: 'Create Server' }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${slug}$`, 'u'));

    await page.getByRole('link', { exact: true, name: 'Members' }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${slug}/members$`, 'u'));

    // The sole Owner cannot strand the Server, and the row says why.
    const leaveButton = page.getByRole('button', { name: 'Leave Server' });
    await expect(leaveButton).toBeDisabled();
    await expect(leaveButton).toHaveAttribute('title', /last Owner/iu);

    await page.getByLabel('Invite by email').fill(peerEmail);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const inviteLink = page.locator('code', { hasText: '/invite/' });
    await expect(inviteLink).toBeVisible();
    const invitePath = new URL((await inviteLink.innerText()).trim()).pathname;
    const invitationRow = page.locator('[data-invitation-id]').filter({ hasText: peerEmail });
    await expect(invitationRow).toContainText('pending');

    // The invited human accepts in their own browser context.
    const peerContext = await browser.newContext();
    const peerPage = await peerContext.newPage();
    await signInAsClerkHuman(peerPage, 'peer');
    await peerPage.goto(invitePath);
    await peerPage.getByRole('button', { name: 'Accept invitation' }).click();

    await expect(peerPage).toHaveURL(new RegExp(`/s/${slug}$`, 'u'));
    await expect(peerPage.getByRole('heading', { level: 2, name: '#all' })).toBeVisible();

    // A single-use token cannot be replayed.
    await peerPage.goto(invitePath);
    await expect(peerPage.getByText('Invitation unavailable')).toBeVisible();

    await page.reload();
    const peerRow = page.locator('[data-member-id]').filter({ hasText: 'member' });
    await expect(peerRow).toHaveCount(1);

    // Elevating a Member to Admin grants authority, so it takes the address too.
    await peerRow.getByRole('button', { name: 'Make Admin' }).click();
    const confirmPromotion = page.getByRole('button', { name: 'Make Admin' }).last();
    const addressField = page.getByLabel('Type the Server address to confirm');
    await expect(addressField).toBeVisible();
    await expect(confirmPromotion).toBeDisabled();
    await addressField.fill('nearly-right');
    await expect(confirmPromotion).toBeDisabled();
    await addressField.fill(slug);
    await expect(confirmPromotion).toBeEnabled();
    await confirmPromotion.click();
    await expect(page.locator('[data-member-id]').filter({ hasText: 'admin' })).toHaveCount(1);

    // The dialog names the human and the role at stake, not just the verb.
    const adminRowForDemotion = page.locator('[data-member-id]').filter({ hasText: 'admin' });
    await adminRowForDemotion.getByRole('button', { name: 'Make Member' }).click();
    await expect(page.getByText(/Human \w+ goes from admin to member/u)).toBeVisible();
    // Stepping down grants nothing, so it stays an ordinary confirmation.
    await expect(page.getByLabel('Type the Server address to confirm')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel' }).click();

    // The removed human is sitting on the Server with its transcript rendered.
    await peerPage.goto(`/s/${slug}`);
    await expect(peerPage.getByRole('heading', { level: 2, name: '#all' })).toBeVisible();

    // Removal is destructive, so it takes the exact Server address.
    const adminRow = page.locator('[data-member-id]').filter({ hasText: 'admin' });
    await adminRow.getByRole('button', { name: 'Remove from Server' }).click();
    await expect(page.getByText(/Human \w+ is currently admin/u)).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Remove from Server' }).last();
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Type the Server address to confirm').fill('wrong');
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Type the Server address to confirm').fill(slug);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.locator('[data-member-id]')).toHaveCount(1);

    // Their open page drops the Server without being reloaded: losing access
    // arrives as a refused subscription, never as data, so the App has to act on
    // the refusal rather than wait for the next navigation.
    await expect(peerPage.getByRole('heading', { level: 2, name: '#all' })).toHaveCount(0);
    await expect(peerPage.getByText('Server unavailable')).toBeVisible();

    await peerContext.close();
});

test('a human outside the Server cannot reach its member management', async ({ page }) => {
    await signInAsClerkHuman(page, 'peer');
    await page.goto(`/s/${slug}/members`);

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByLabel('Invite by email')).toHaveCount(0);
});
