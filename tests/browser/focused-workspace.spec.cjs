const {test,expect}=require('@playwright/test');
for(const lang of ['ar','en']){
  test('focused workspace journey '+lang,async({page})=>{
    await page.goto('/login?lang='+lang);
    await page.locator('[name=email]').fill('service@example.test');
    await page.locator('[name=password]').fill('service-test-password');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/app');
    await page.goto('/app/workflows?lang='+lang);
    const form=page.locator('#flow-form');
    await form.locator('[name=template]').selectOption('1');
    await expect(form.locator('.flow-node')).toHaveCount(2);
    await form.locator('[name=name]').fill('Schedule '+lang);
    await form.locator('button[type=submit]').click();
    await expect(page.locator('#publish-flow')).toBeDisabled();
    await page.locator('#simulate-flow [name=office_hours]').selectOption('no');
    await page.locator('#simulate-flow button[type=submit]').click();
    await expect(page.locator('#flow-trace')).toContainText('2.');
    await expect(page.locator('#publish-flow')).toBeEnabled();
    await page.locator('#publish-flow').click();await expect(page.locator('#pause-flow')).toBeVisible();
    await page.locator('#pause-flow').click();await expect(page.locator('#pause-flow')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await page.goto('/app/agents?lang='+lang);await page.locator('#agent-new').click();
    await page.locator('[name=preset]').selectOption('sales');
    await expect(page.locator('#create-agent [name=name]')).toHaveValue(lang==='ar'?'وكيل المبيعات':'Sales agent');
    await page.goto('/app/channels?lang='+lang);
    await expect(page.locator('.wa-progress')).toContainText('0 / 5');
    await expect(page.locator('.wa-setup [aria-current=step]')).toHaveCount(1);
  });
}

test('review CSV, update the profile, and reopen a saved segment',async({page})=>{
  await page.goto('/login?lang=en');
  await page.locator('[name=email]').fill('service@example.test');
  await page.locator('[name=password]').fill('service-test-password');
  await page.locator('button[type=submit]').click();await page.waitForURL('**/app');
  await page.goto('/app/contacts?lang=en');
  await page.locator('#import-csv').click();
  const dialog=page.locator('#dialog'), csv='name,phone,tags\nFocused Customer,+966511234567,trial';
  await dialog.locator('[type=file]').setInputFiles({name:'customers.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(dialog.locator('[type=submit]')).toBeDisabled();
  await dialog.locator('#preview-import').click();
  await expect(dialog.locator('#import-results')).toContainText('Ready');
  await dialog.locator('[type=submit]').click();
  await page.locator('#contact-search').fill('Focused Customer');
  await page.locator('[data-profile]').first().click();
  await dialog.locator('[name=stage]').selectOption('interested');
  await dialog.locator('[name=email]').fill('focused@example.test');
  await dialog.locator('[type=submit]').click();
  await expect(page.locator('#contacts-table')).toContainText('Interested');
  await page.locator('.service-toolbar [name=stage]').selectOption('interested');
  await page.locator('#save-segment').click();await dialog.locator('[name=name]').fill('Interested QA');
  await dialog.locator('[type=submit]').click();
  const saved=page.locator('[name=segment]');await saved.selectOption({label:'Interested QA'});
  await expect(page.locator('.service-toolbar [name=stage]')).toHaveValue('interested');
  await expect(page.locator('#contacts-table')).toContainText('focused@example.test');
});
