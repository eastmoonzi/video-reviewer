const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8001');
    await page.waitForTimeout(2000);
    const dock = await page.locator('#rating-dock');
    const bottom = await dock.evaluate(el => window.getComputedStyle(el).bottom);
    const position = await dock.evaluate(el => window.getComputedStyle(el).position);
    const dockTop = await dock.evaluate(el => el.getBoundingClientRect().top);
    console.log('Dock computed bottom:', bottom);
    console.log('Dock computed position:', position);
    console.log('Dock top bounding client rect:', dockTop);
    
    // Also check a random element's color to see if styling is applied
    const title = await page.locator('h1').first();
    const color = await title.evaluate(el => window.getComputedStyle(el).color);
    console.log('Title color:', color);

    // Also check if css is loaded
    const sheets = await page.evaluate(() => Array.from(document.styleSheets).map(s => s.href));
    console.log('StyleSheets:', sheets);

    await browser.close();
})();
