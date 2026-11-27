const {test, expect} = require('@playwright/test');

test('theme survives login and navigation, and an expanded table keeps its actions', async ({page}) => {
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/?lang=en');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:/Salem/}).click();
  await expect(page.locator('.example-thread:visible')).toContainText('Thursday');
  await page.getByRole('button',{name:'Dark mode'}).click();
  await page.goto('/login?lang=en');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.locator('[name=email]').fill('service@example.test');
  await page.locator('[name=password]').fill('service-test-password');
  await page.locator('#login-form button').click();
  await page.waitForURL('**/app');
  await page.getByRole('button',{name:'Dark mode'}).click();
  await page.goto('/app/team?lang=en');
  const expand=page.getByRole('button',{name:/Expand table/}).first();
  await expand.click();
  const sheet=page.locator('.sheet-dialog[open]');
  await expect(sheet.locator('tbody tr').first()).toBeVisible();
  await expect(sheet.locator('table')).toContainText('Service QA');
  expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();
  await expect(page.getByRole('button',{name:'Dark mode'})).toHaveAttribute('aria-pressed','true');
});

test('phone inbox can return to the list and restore its draft',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login?lang=ar');
  await page.locator('[name=email]').fill('service@example.test');
  await page.locator('[name=password]').fill('service-test-password');
  await page.locator('#login-form button').click();
  await page.waitForURL('**/app');
  await page.goto('/app/inbox');
  const ticket=page.locator('.service-ticket').first();
  await ticket.click();
  const draft=page.locator('#service-composer textarea');
  await draft.fill('مسودة لم ترسل');
  await page.locator('#back-to-tickets').click();
  await expect(ticket).toBeVisible();
  await ticket.click();
  await expect(draft).toHaveValue('مسودة لم ترسل');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
