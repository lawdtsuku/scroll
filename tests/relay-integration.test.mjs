import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {RELAY_BASE} from '../dist/relay-sync.js';
const root=new URL('../dist/',import.meta.url);
const source=name=>readFileSync(new URL(name,root),'utf8');
test('relay CSP first meta connects only to configured relay and self',()=>{
  const html=source('index.html'),first=html.match(/<head>\s*(<meta[^>]+>)/)[1];assert.match(first,/http-equiv="Content-Security-Policy"/);assert.ok(first.includes(`connect-src 'self' ${RELAY_BASE};`));assert.match(first,/script-src 'self';/);assert.match(first,/object-src 'none'/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html));assert.ok(!/url\(|@import/i.test(source('style.css')));
});
test('relay service worker assets cover every static import reachable from app',()=>{
  const sw=source('sw.js'),assets=new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]));const visited=new Set();
  function walk(file){if(visited.has(file))return;visited.add(file);assert.ok(assets.has(file),'Missing offline asset: '+file);for(const m of source(file).matchAll(/(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]\.\/([^'"]+)['"]/g))walk(m[1]);}
  walk('app.js');for(const f of ['relay-client.js','relay-projection.js','relay-sync.js','relay-controller.js','relay-review.js'])assert.ok(visited.has(f));assert.match(sw,/scroll-consolidated-v24/);
});
test('relay integration keeps credential input concealed and dynamic proposal text escaped',()=>{
  const app=source('app.js');assert.match(app,/id="relay-pair-code" type="password" autocomplete="off"/);assert.match(app,/if\(input\)input.value='';const r=await relay.pair/);for(const value of ['p.update_id','p.summary','status.text','state.lineage_id.slice(0,12)'])assert.ok(app.includes(`esc(${value})`));
  assert.match(app,/onStale\?onStale\(\):reviewImport\(JSON.stringify\(p.importEnvelope\)\)/);
  assert.match(app,/relayAfterSave\(p.next.transactions.at\(-1\)\?\.source==='restore'\?'restore':'commit'\)/);
  assert.match(app,/function relayAfterSave\(reason\)\{try\{setTimeout\(\(\)=>\{try\{void relay.kick\(reason\);\}catch\{\}\},0\);\}catch\{\}\}/);
  assert.match(app,/isBusy:\(\)=>modal.open\|\|!!routineDraft\|\|saving/);
});
test('relay pure modules contain no ambient I/O or manual exchange dependencies',()=>{
  const controller=source('relay-controller.js');assert.ok(!/\b(window|navigator|Date|setTimeout)\b/.test(controller));assert.ok(!/\bfetch\s*\(/.test(controller));
  const review=source('relay-review.js');assert.ok(!/\b(importConfirmed|saveExchange|copyDialog|exchange|updateDraft|commit)\s*\(/.test(review));
});
