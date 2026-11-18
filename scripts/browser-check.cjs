const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.argv[2] || 'http://localhost:3100';
const out=process.env.EVIDENCE_DIR || '/tmp/packproof-ui-evidence';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
 let checks=0;
 for(const width of [320,390,768,1440]){
  const p=await b.newPage({viewport:{width,height:1000},isMobile:width<500,hasTouch:width<500});
  for(const [path,name] of [['/','home'],['/skills','skills'],['/packs/pr-review-pass','pack'],['/reports/api-change-safety-net','report'],['/signin','signin']]){
   await p.goto(base+path); await p.evaluate(()=>document.fonts.ready);
   await p.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
   const d=await p.evaluate(()=>({inner:innerWidth,page:document.documentElement.scrollWidth}));
   assert.equal(d.inner,width,`${path} inflated viewport at ${width}`);assert(d.page<=width+1,`${path} overflows ${width}: ${d.page}`);checks++;
   if(width===390 || width===1440)await p.screenshot({path:`${out}/${name}-${width}.png`});
  }
  await p.goto(base+'/skills');
  await p.locator('.wordmark').focus();
  for(const dest of ['Skills','Packs','Methodology','Changelog','Categories','Discover']){
   const link=p.locator('.nav-links').getByRole('link',{name:dest,exact:true});const r=await link.boundingBox();assert(r && r.x>=0 && r.x+r.width<=width+1,`nav ${dest} clipped at ${width}`);await p.keyboard.press('Tab');assert(await link.evaluate(e=>e===document.activeElement));checks++;
  }
  await p.getByRole('combobox',{name:'Task',exact:true}).selectOption('Video & motion');
  assert.equal(await p.locator('.skill-note').count(),3);checks++;
  await p.getByRole('button',{name:'Antigravity',exact:true}).click();assert.equal(await p.locator('.skill-note').count(),0);checks++;
  await p.getByRole('button',{name:'Reset filters'}).click();assert.equal(await p.locator('.skill-note').count(),19);checks++;
  await p.getByRole('searchbox',{name:'What are you making?'}).fill('pdf');assert.equal(await p.locator('.skill-note').count(),1);checks++;
  await p.goto(base+'/skills?task=Video%20%26%20motion');assert.equal(await p.locator('.skill-note').count(),3);checks++;
  await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/skills');assert.equal(await p.locator('.field-index').evaluate(e=>getComputedStyle(e).animationName),'none');checks++;
  await p.goto(base+'/packs/pr-review-pass');await p.getByRole('combobox',{name:'Save for'}).selectOption('claude');assert((await p.locator('.install-cmd code').innerText()).includes('.claude/skills/pr-review-pass'));checks++;
  await p.getByRole('combobox',{name:'Save for'}).selectOption('antigravity');assert((await p.locator('.install-cmd code').innerText()).includes('.agents/skills/pr-review-pass'));checks++;
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}},configurable:true});document.execCommand=()=>false});
  await p.locator('.install-cmd .copybtn').click();assert.equal(await p.locator('.install-cmd .copybtn').innerText(),'select command to copy');checks++;
  const d=await p.evaluate(()=>({inner:innerWidth,page:document.documentElement.scrollWidth}));assert.equal(d.inner,width);assert(d.page<=width+1);checks++;
  if(width===390) {await p.locator('.install').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/install-failure-390.png`});}
  await p.close();
 }
 await b.close();console.log(JSON.stringify({browserChecks:checks,evidenceDirectory:out,widths:[320,390,768,1440]}));
})().catch(e=>{console.error(e);process.exit(1)});
