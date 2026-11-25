const {test,expect}=require('@playwright/test');

function gate(){
  let release;
  const waiting=new Promise(resolve=>{release=resolve});
  return {waiting,release};
}
async function expectBubble(element){
  await expect(element).toBeVisible();
  await expect.poll(()=>element.evaluate(el=>getComputedStyle(el,'::before').backgroundImage))
    .toContain('/static/labbily/loading.svg');
}

test('provider sees one branded indicator through initial load and concurrent refresh',async({page})=>{
  const startup=gate();
  await page.route('**/api/catalog?*',async route=>{await startup.waiting;await route.continue()},{times:1});
  await page.goto('/login?lang=ar');
  await expectBubble(page.locator('#app .loading'));
  startup.release();
  await page.locator('[name=email]').fill('ui@example.test');
  await page.locator('[name=password]').fill('ui-only-long-password');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/app');
  const integration=gate();
  await page.route('**/api/admin/integrations',async route=>{await integration.waiting;await route.continue()},{times:1});
  await page.goto('/app/integrations?lang=ar');
  await expectBubble(page.locator('.app-main .loading'));
  await expect(page.locator('.request-activity:visible')).toHaveCount(0);
  integration.release();
  const refresh=page.locator('#integration-refresh');
  await expect(refresh).toBeVisible();
  const first=gate(),last=gate();
  // Keep interception installed while both requests are in flight.
  const bothStarted=gate(),started=new Set();
  await page.route(/\/api\/admin\/(integrations|tenants)$/,async route=>{
    const resource=route.request().url().split('/').pop();
    started.add(resource);
    if(started.size===2)bothStarted.release();
    await (resource==='integrations'?first:last).waiting;
    await route.continue();
  });
  await refresh.click();
  await bothStarted.waiting;
  const chip=page.locator('.request-activity');
  await expectBubble(chip);
  const received=page.waitForResponse(response=>response.url().endsWith('/api/admin/integrations'));
  first.release();
  await received;
  await expect(chip).toBeVisible();
  last.release();
  await expect(chip).toHaveCount(0);
});

test('standalone authorization clears its branded loader on failure',async({page})=>{
  const pending=gate();
  await page.route('**/api/me',async route=>{await pending.waiting;await route.fulfill({status:401,json:{}})});
  await page.goto('/api/v2/oauth/instagram/callback');
  await expectBubble(page.locator('#oauth-status'));
  pending.release();
  await expect(page.locator('#oauth-status')).toContainText('Sign in again');
  await expect(page.locator('.loading')).toHaveCount(0);
});
