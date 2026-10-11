import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newExchange,restoreExchange,importConfirmed,exchangeStatus} from '../dist/exchange.js';
import {tabBadges} from '../dist/attention.js';
import {newCampaign,prepareCreation,summary,clone} from '../dist/core.js';
import {previewUpdate} from '../dist/updates.js';
import {exportSnapshot} from '../dist/snapshot.js';
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const declaration=name=>app.split('\n').find(line=>line.startsWith('function '+name+'('));
test('reference card stays visible with owner stats hidden; both notices export the exact pending character',()=>{
 const characters=[{character_id:'a',name:'Owner A',reference_revision:2,profile:{}},{character_id:'b',name:'Owner B',reference_revision:3,profile:{}}];
 const ctx={state:{characters},refMarks:{a:2,b:2},selected:()=>characters[0],heading:()=>'',ownerSheetEnabled:()=>false,esc:s=>s??'',exchangeStepper:()=>''};
 vm.createContext(ctx);vm.runInContext(['referenceReminder','referenceView','updatesView'].map(declaration).join('\n'),ctx);
 let html=vm.runInContext('referenceView()',ctx);assert.match(html,/<section class="card character-reference"><h2>Character reference/);assert.ok(html.indexOf('data-action="reference-export"')<html.indexOf('<details class="reference-management"'));
 html=vm.runInContext('updatesView()',ctx);assert.match(html,/data-reference-character="b">Export character reference/);assert.doesNotMatch(html,/data-reference-character="a"/);
 ctx.selected=()=>characters[1];html=vm.runInContext('referenceView()',ctx);assert.match(html,/reference-reminder/);assert.match(html,/data-reference-character="b">Export character reference/);
});
test('explicit skip unlocks only import without claiming copies; restores and resets as device progress',()=>{
 const s={current_revision:1,transactions:[],scheduler:{events:[]}},w={...newExchange(s),skipped_handoff:true};
 assert.deepEqual(exchangeStatus(w,false).done,[true,false,false,false]);assert.equal(w.copied_state,false);assert.equal(w.copied_instructions,false);
 assert.equal(exchangeStatus(w,false).canFinish,false);assert.equal(tabBadges(s,[],w,false).updates,true);
 assert.equal(restoreExchange(w,s).skipped_handoff,true);assert.equal(restoreExchange(w,{...s,current_revision:2}).skipped_handoff,false);
 const legacy={...w};delete legacy.skipped_handoff;assert.equal(restoreExchange(legacy,s).skipped_handoff,false);
 const saved=importConfirmed(w,{...s,current_revision:2},{update_id:'ok'});assert.equal(saved.skipped_handoff,true);assert.deepEqual(exchangeStatus(saved,false).done,[true,true,false,false]);assert.equal(saved.copied_state,false);assert.equal(newExchange(s).skipped_handoff,false);
});
test('full copy path still needs both acknowledgments; skip never enters campaign exports or alters rejection',()=>{
 const s=prepareCreation(newCampaign({display_name:'Reference audit',character_name:'Owner'}),'Opening').next;
 let w=newExchange(s);w.copied_state=true;assert.equal(exchangeStatus(w,false).done[0],false);w.copied_instructions=true;assert.equal(exchangeStatus(w,false).done[0],true);assert.equal(w.skipped_handoff,false);
 w={...newExchange(s),skipped_handoff:true};const before=JSON.stringify(s),progress=JSON.stringify(w),u={format:'scroll-session-update',version:1,campaign_id:s.campaign_id,lineage_id:s.lineage_id,update_id:'skip-test',base_revision:s.current_revision,operations:[{op:'adjust_currency',character_id:s.characters[0].character_id,delta:1,reason:'Test'}]};
 assert.throws(()=>previewUpdate(s,{...u,base_revision:s.current_revision-1}),e=>e.code==='STALE_REVISION');
 assert.throws(()=>previewUpdate(s,{...u,operations:[...u.operations,{op:'set_attribute',character_id:s.characters[0].character_id,key:'not-present',value:1,note:'Test',reason:'Test'}]}),/Unknown attribute key/);
 assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(w),progress);
 const p=previewUpdate(s,u);for(const output of [summary(s),JSON.stringify(p.receipt),JSON.stringify(exportSnapshot(s,s.characters[0].character_id)),JSON.stringify(clone(s.characters[0]))])assert.doesNotMatch(output,/skipped_handoff/);
});
