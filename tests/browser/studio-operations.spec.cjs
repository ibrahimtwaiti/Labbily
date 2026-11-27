const {test,expect}=require('@playwright/test');
async function login(page){
 await page.goto('/login?lang=en');
 await page.locator('[name=email]').fill('meta@example.test');
 await page.locator('[name=password]').fill('service-test-password');
 await page.locator('#login-form button').click();
 await page.waitForURL('**/app');
}
test('create, reschedule and complete a task across calendar views',async({page})=>{
 await login(page);await page.goto('/app/tasks?lang=en');
 await expect(page.locator('.cal-grid.week .cal-cell')).toHaveCount(168);
 await page.locator('#add-task').click();
 let dialog=page.locator('#dialog');
 await dialog.locator('[name=title]').fill('Calendar follow-up');
 await dialog.locator('[name=due_at]').fill('2027-01-01T00:15');
 await dialog.locator('[name=priority]').selectOption('high');
 await dialog.locator('[type=submit]').click();
 await page.locator('[data-mode=month]').click();
 await expect(page.locator('#cal-caption')).toContainText('January 2027');
 await page.locator('.cal-job').filter({hasText:'Calendar follow-up'}).click();
 await dialog.locator('[name=due_at]').fill('2027-02-28T23:45');
 await dialog.locator('[name=status]').selectOption('done');
 await dialog.locator('[type=submit]').click();
 await expect(page.locator('#cal-caption')).toContainText('February 2027');
 await page.locator('[data-mode=list]').click();
 await expect(page.locator('#cal-body')).toContainText('2027-02-28 23:45');
 await expect(page.locator('#cal-body')).toContainText('Done');
 await page.locator('[data-mode=board]').click();
 await expect(page.locator('.task-board section').last()).toContainText('Calendar follow-up');
 await page.reload();await page.locator('[data-mode=list]').click();
 await expect(page.locator('#cal-body')).toContainText('Calendar follow-up');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('template canvas, agent gallery, onboarding and channel catalog',async({page})=>{
 await login(page);await page.goto('/app/workflows?lang=en');
 await page.locator('#flow-templates').click();await page.locator('[data-template="4"]').click();
 await expect(page.locator('#trigger-title')).toHaveText('Contact created');
 await page.locator('#zoom-in').click();await expect(page.locator('#flow-scale')).toHaveText('110%');
 await page.locator('#add-step').click();await expect(page.locator('.flow-node')).toHaveCount(3);
 await page.locator('#flow-undo').click();await expect(page.locator('.flow-node')).toHaveCount(2);
 await page.locator('#flow-redo').click();await expect(page.locator('.flow-node')).toHaveCount(3);
 await page.goto('/app/agents?lang=en');await page.locator('[data-preset=booking]').click();
 await expect(page.locator('#create-agent [name=name]')).toHaveValue('Appointment coordinator');
 await page.goto('/app/setup?lang=en');await expect(page.locator('.setup-checklist details')).toHaveCount(5);
 await page.goto('/app/channels?lang=en');await page.locator('#app-search').fill('Instagram');
 await expect(page.locator('.service-accounts article:visible')).toHaveCount(1);
 await page.locator('.service-accounts article:visible button').click();
 await expect(page.locator('#instagram-connect')).toBeInViewport();
 await page.locator('#channel-accounts').click();await expect(page.locator('.channel-operations')).toContainText('QA WhatsApp');
 await page.goto('/app/campaigns?lang=en');await page.locator('#new-campaign').click();
 await page.locator('#dialog [name=name]').fill('Studio preview plan');
 await page.locator('#dialog [name=body]').fill('A planned message');
 await page.locator('#dialog [type=submit]').click();await expect(page.locator('#campaign-list')).toContainText('Studio preview plan');
});

