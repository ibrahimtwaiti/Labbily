const {test,expect}=require('@playwright/test');
for(const lang of ['ar','en']){
 test(`${lang}: public pages, mobile navigation, language and request`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?lang='+lang);await expect(page.locator('.brand-hero')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir',lang==='ar'?'rtl':'ltr');
  for(const route of ['/','/services','/services/crm','/platform','/how-it-works','/about','/faq','/privacy','/terms','/login','/request']){
   await page.goto(route+'?lang='+lang);await expect(page.locator('main h1')).toBeVisible();
   if(route==='/privacy')await expect(page.locator('article.policy')).toContainText(lang==='en'?'Privacy Policy':'سياسة الخصوصية');
   if(route==='/terms')await expect(page.locator('article.policy')).toContainText(lang==='en'?'Terms of Use':'شروط استخدام');
   await expect(page.locator('main h1')).not.toContainText(/تعذر تحميل|Unable to load/);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBeTruthy();
   if(lang==='en')expect(await page.locator('main').innerText(),route).not.toMatch(/[\u0600-\u06ff]/);
  }
  await page.goto('/?lang='+lang);
  if(await page.locator('#menu-toggle').isVisible()){await page.locator('#menu-toggle').click();await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Escape');await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded','false')}
  await page.locator('details').first().locator('summary').click();await expect(page.locator('details').first()).toHaveAttribute('open','');
  await page.goto('/request?lang='+lang);
  for(const [name,value] of Object.entries({name:'Browser QA',company:'Isolated test',phone:'+966500000001',country:'Saudi Arabia',activity:'Testing',need:'Browser request flow'}))await page.locator(`[name=${name}]`).fill(value);
  await page.locator('[name=contact_consent]').check();if(lang==='en'){await page.locator('button[type=submit]').click();await expect(page.locator('.success')).toContainText('WS-');}
  expect(errors).toEqual([]);
 });
}
test('provider identity persists and protected UI is usable',async({page})=>{
 await page.goto('/login?lang=en');await page.locator('[name=email]').fill('ui@example.test');await page.locator('[name=password]').fill('ui-only-long-password');await page.locator('button[type=submit]').click();await page.waitForURL('**/app');
 await expect(page.locator('.app-layout')).toBeVisible();
 await expect(page.locator('#main h1')).toBeVisible();
 await page.goto('/app/content?lang=en');await expect(page.locator('#brand-form')).toBeVisible();
 await page.locator('#brand-form [name=primary]').fill('#7650cc');await page.locator('#brand-form button[type=submit]').click();await expect(page.locator('#toast')).toBeVisible();
 await page.reload();await expect(page.locator('#brand-form [name=primary]')).toHaveValue('#7650cc');
 await page.locator('#brand-form [name=primary]').fill('#834dfb');await page.locator('#brand-form button[type=submit]').click();await expect(page.locator('#toast')).toBeVisible();
});
test('reduced motion leaves all sections visible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.brand-hero')).toBeVisible();expect(await page.locator('.reveal-ready').count()).toBe(0);
});

test('temporary session lookup failure offers retry without logging out',async({page})=>{
 await page.route('**/api/me',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Temporary service interruption'})}));
 await page.goto('/app?lang=en');
 await expect(page.locator('#reload')).toBeVisible();
 await expect(page).toHaveURL(/\/app\?lang=en$/);
 await expect(page.locator('main')).toContainText('Temporary service interruption');
});
test('unauthenticated protected page redirects to login',async({page})=>{
 await page.goto('/app/content?lang=en');
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page).toHaveURL(/\/login$/);
});

for (const lang of ['ar', 'en']) {
 test(`${lang}: solution filters, related pages and demo interest`, async ({page}) => {
  await page.goto('/services?lang=' + lang);
  const cards = page.locator('#service-grid .solution-card:visible');
  await expect(cards).toHaveCount(10);
  for (const [group, count] of Object.entries({service:3, automation:2, marketing:2, integrations:2, governance:1, all:10})) {
   const button = page.locator(`[data-filter="${group}"]`);
   await button.focus();
   await page.keyboard.press('Enter');
   await expect(button).toHaveAttribute('aria-pressed', 'true');
   await expect(cards).toHaveCount(count);
  }
  await cards.locator('[href="/services/campaigns"]').click();
  await expect(page.locator('main [data-status="planned"]').first()).toBeVisible();
  await expect(page.locator('main a[href*="/request"]')).toHaveCount(0);
  await page.locator('main a[href="/services/analytics"]').click();
  await page.locator('main a[href="/request?service=analytics"]').first().click();
  await expect(page.locator('select[name="service"]')).toHaveValue('analytics');
  await expect(page.locator('select[name="service"] option[value="campaigns"]')).toHaveCount(0);
 });
}
