// Built app with mocked offers: never sends requests to a real API.
const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '../dist/frontend_web_angular/browser');
  const artifacts = path.resolve(__dirname, '../test-results/delivery-typography');
  fs.mkdirSync(artifacts, { recursive: true });
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, 'index.html');
    const mime = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const routes = ['pharmacy-orders', 'material-orders', 'pharmacy-orders/select', 'material-orders/select', 'pharmacy-orders/test', 'material-orders/test', 'pharmacy-orders/test/payment', 'material-orders/test/payment', 'pharmacy-orders/test/delivery', 'pharmacy-orders/test/delivery-offer', 'material-orders/test/delivery-offer'];
    for (const width of [1440, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(() => {
        const token = btoa('{}') + '.' + btoa(JSON.stringify({ sub: 'test-user', role: 'CLIENT', exp: Date.now()/1000+3600 })) + '.test';
        localStorage.setItem('accessToken', token);
        localStorage.setItem('currentUser', JSON.stringify({ id:'test-user', name:'Client test', role:'CLIENT' }));
      });
      await context.route('https://**', route => route.abort());
      const now = new Date().toISOString();
      const common = { id:'test', status:'EN_ATTENTE_PAIEMENT', deliveryRequested:true, deliveryAmount:1000, deliveryDistanceKm:2, distanceKm:1, courierDistanceKm:1, pricePerKm:500, deliveryAddress:'Dakar Plateau', totalAmount:6000, deliveryReservation:null, validatedAt:now, paidAt:null, createdAt:now, unavailableItems:[], client:{ id:'test-user',nom:'Client test',adresse:'Dakar Plateau' } };
      const pharmacy = { ...common, medicineAmount:5000, pharmacyNote:null, payment:null, medicineItems:[{position:0,name:'Article de démonstration',isAvailable:true,price:5000}], pharmacy:{id:'store',userId:'merchant',name:'Pharmacie de démonstration'}, medicalReservation:{id:'medical',scheduledAt:now,prescription:{acts:[],vaccines:[],treatments:['Article de démonstration']},prescriber:{name:'Médecin test',avatarUrl:null,specialty:'Médecine générale',rating:4,totalReviews:3}} };
      const material = { ...common,materialAmount:5000,note:null, items:[{position:0,name:'Matériel de démonstration',quantity:2,isAvailable:true,unitPrice:2500}],hardwareStore:{id:'store',userId:'merchant',name:'Quincaillerie de démonstration'},reservation:{id:'booking',scheduledAt:now,status:'CONFIRMEE',address:'Dakar',service:{id:'service',nom:'Réparation'},provider:{id:'provider',name:'Prestataire test'}} };
      await context.route('http://localhost:3000/**', async route => {
        const path = new URL(route.request().url()).pathname;
        let data = [];
        if(path.endsWith('/users/me')) data = {id:'test-user',nom:'Client test',role:'CLIENT'};
        else if(path.includes('/pharmacy-orders/test')) data=pharmacy;
        else if(path.includes('/material-orders/test')) data=material;
        else if(path.endsWith('/pharmacy-orders')) data=[pharmacy];
        else if(path.endsWith('/material-orders')) data=[material];
        else if(path.endsWith('/access')) data={isPharmacy:false,isHardwareStore:false};
        await route.fulfill({json:{success:true,data}});
      });
      for(const route of routes) {
        const page=await context.newPage();
        const errors=[]; page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base+'/'+route);
        const host=page.locator('app-pharmacy-orders-inbox-page, app-material-orders-inbox-page, app-pharmacy-selection-page, app-hardware-store-selection-page, app-pharmacy-order-detail-page, app-material-order-detail-page, app-pharmacy-order-payment-page, app-material-order-payment-page, app-pharmacy-order-delivery-page, app-pharmacy-delivery-offer-page').first();
        await expect(host).toBeVisible();
        await page.waitForTimeout(300);
        const metrics=await host.evaluate(el=>({font:getComputedStyle(el).fontFamily, width:document.documentElement.scrollWidth, title:[...el.querySelectorAll('h1')].map(h=>getComputedStyle(h).fontSize)}));
        if(!metrics.font.includes('Inter')) throw new Error(route+' font '+metrics.font);
        if(metrics.width>width+1) throw new Error(route+' overflows '+metrics.width+' at '+width);
        if(errors.length) throw new Error(route+': '+errors.join(';'));
        await page.screenshot({path:path.join(artifacts,route.replaceAll('/','-')+'-'+width+'.png')});
        console.log('Verified '+route+' '+width+'px '+JSON.stringify(metrics));
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
