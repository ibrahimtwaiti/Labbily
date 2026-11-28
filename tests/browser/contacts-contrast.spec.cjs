const {test,expect}=require('@playwright/test');

for(const lang of ['ar','en']){
  test(`contacts empty state and search contrast in ${lang}`,async({page},testInfo)=>{
    await page.goto('/login?lang='+lang);
    await page.locator('[name=email]').fill('service@example.test');
    await page.locator('[name=password]').fill('service-test-password');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/app');
    await page.route('**/api/v2/crm/contacts?*',route=>route.fulfill({json:{items:[],next:null}}));
    await page.goto('/app/contacts?lang='+lang);
    const card=page.locator('#contacts-table > .empty');
    await expect(card.locator('h3')).toHaveText(lang==='ar'?'لا توجد جهات اتصال':'No contacts');
    const icon=card.locator('img');
    await expect(icon).toHaveAttribute('src','/static/labbily/contact-book.svg');
    await icon.evaluate(el=>el.decode());
    await expect(icon).toHaveCSS('width','88px');
    await expect(card).toHaveCSS('background-color','rgb(255, 255, 255)');
    const contrast=async (selector,background)=>page.evaluate(({selector,background})=>{
      const luminance=value=>{
        const [r,g,b]=value.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255)
          .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
        return .2126*r+.7152*g+.0722*b;
      };
      const a=luminance(getComputedStyle(document.querySelector(selector)).color);
      const b=luminance(getComputedStyle(document.querySelector(background)).backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    },{selector,background});
    for(const selector of ['#contacts-table h3','#contacts-table p']){
      expect(await contrast(selector,'#contacts-table .empty')).toBeGreaterThanOrEqual(4.5);
    }
    const exportSelector='.toolbar [href="/api/contacts/export"]';
    await expect(page.locator(exportSelector)).toBeVisible();
    expect(await contrast(exportSelector,exportSelector)).toBeGreaterThanOrEqual(4.5);
    if(testInfo.project.name==='webkit-mobile'){
      await page.locator(exportSelector).focus();
      await page.keyboard.press('Shift');
    }else{
      await page.locator('#contact-search').focus();
      await page.keyboard.press('Tab');
    }
    await expect(page.locator(exportSelector)).toBeFocused();
    await expect(page.locator(exportSelector)).toHaveCSS('outline-style','solid');
    if(lang==='ar')await testInfo.attach('contacts-empty',{body:await page.screenshot(),contentType:'image/png'});
    await page.locator('#contact-search').fill('999');
    await expect(card.locator('h3')).toHaveText(lang==='ar'?'لا توجد نتائج مطابقة':'No matching contacts');
    await page.locator('#contact-search').fill('');
    await expect(card.locator('h3')).toHaveText(lang==='ar'?'لا توجد جهات اتصال':'No contacts');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    const art=await page.request.get('/static/labbily/digital/light/empty.svg');
    expect(art.ok()).toBeTruthy();
    expect(await art.text()).not.toContain('<text');
  });
}
