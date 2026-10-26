import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {validateState,backup,prepareRestore} from '../dist/core.js';
import {previewUpdate,operationsKey} from '../dist/updates.js';
import {createReconciler,createRelayClient,classifyResponse} from '../dist/relay-client.js';
import {createRelaySync,eligibleReceipts,statusView,lineageConsequenceText,syncKey,offeredKey,CREDENTIAL_KEY} from '../dist/relay-sync.js';
const clone=structuredClone;
function seed(){return validateState({schema_version:2,campaign_id:'synthetic-test1',lineage_id:'synthetic-lineage1',display_name:'Synthetic',system_label:'Synthetic',current_day:1,day_label:{singular:'day',plural:'days'},day_zero_note:'',resources:[],currency:{id:'coins',label:'Coins'},level_thresholds:{},ability_slots_enabled:false,current_revision:1,characters:[{character_id:'hero',campaign_id:'synthetic-test1',name:'Hero',level:1,xp_total:0,resources:[],currency_amount:10,attributes:[],profile:{},inventory:[],reference_revision:0}],journal:[],transactions:[],sessions:[],recovery:[],pending_migration:null});}
const update=(s,id='u',delta=1)=>({format:'scroll-session-update',version:1,campaign_id:s.campaign_id,lineage_id:s.lineage_id,update_id:id,base_revision:s.current_revision,operations:[{op:'adjust_currency',character_id:'hero',delta,reason:'Synthetic'}]});
const key=u=>`${u.lineage_id}:${u.update_id}`;
const ok=(code='accepted',body={})=>({kind:'ok',code,retry:false,body});
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const view=(overrides={})=>statusView({paired:true,enabled:true,online:true,pendingReceipts:0,publishedRevision:1,localRevision:1,...overrides});
function harness({state=seed(),locks}={}){
  const prefs=new Map(),campaigns=new Map([[state.campaign_id,clone(state)]]),writes=[];
  const deps={getPreference:async k=>clone(prefs.get(k)),setPreference:async(k,v)=>{writes.push(k);prefs.set(k,clone(v));},allCampaigns:async()=>clone([...campaigns.values()]),getCampaign:async id=>clone(campaigns.get(id)),locks,operationsKey,now:()=>0};
  const sync=createRelaySync(deps);
  const current=()=>campaigns.get(state.campaign_id);
  const commit=(id,delta=1)=>{const u=update(current(),id,delta),p=previewUpdate(current(),u);campaigns.set(state.campaign_id,p.next);return u;};
  const mark=u=>sync.markRelayUpdate(u.campaign_id,u.lineage_id,u.update_id,operationsKey(u.operations));
  return {prefs,campaigns,deps,sync,current,commit,mark,writes};
}
function client(overrides={}){return {postReceipt:async()=>ok('receipt_recorded'),publishSnapshot:async()=>ok(),switchLineage:async()=>ok('switched'),fetchProposals:async()=>ok('ok',{proposals:[]}),...overrides};}
const run=async(h,c=client())=>{await h.sync.setEnabled('synthetic-test1',true);return h.sync.runReconcile(createReconciler({client:c,store:h.sync.store,now:()=>0}),'test');};

test('sync manual receipt blocker: only exact offered update is sent and real reconciler publishes',async()=>{
  const h=harness();for(const id of ['m1','m2','m3'])h.commit(id);const u=h.commit('relay');await h.mark(u);
  assert.deepEqual((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.map(r=>r.update_id),['relay']);
  const sent=[];let published=0;const result=await run(h,client({postReceipt:async r=>{sent.push(r.update_id);return r.update_id==='relay'?ok('receipt_recorded'):{...classifyResponse({status:404,body:{ok:false,code:'unknown_update'}}),body:null};},publishSnapshot:async()=>{published++;return ok();}}));
  assert.deepEqual(sent,['relay']);assert.equal(published,1);assert.equal(result.campaigns[0].problem,null);
});
test('sync lineage filtering excludes ancestral transaction and receipt identities independently',()=>{
  const h=harness(),u=h.commit('old'),s=h.current(),map={[key(u)]:operationsKey(u.operations)};
  const restored=prepareRestore(backup(s),s,'Synthetic restore').next;
  assert.deepEqual(eligibleReceipts(restored,{},map),[]);
  const malformed=clone(restored);malformed.transactions.find(t=>t.update).update.receipt.lineage_id=restored.lineage_id;
  assert.deepEqual(eligibleReceipts(malformed,{},map),[]);
  const malformed2=clone(restored);malformed2.transactions.find(t=>t.update).update.lineage_id=restored.lineage_id;
  assert.deepEqual(eligibleReceipts(malformed2,{}, {[`${restored.lineage_id}:old`]:operationsKey(u.operations)}),[]);
});
test('sync malformed and oversized manual receipts never queue without offer markers',()=>{
  const h=harness();h.commit('malformed');h.commit('oversize');const s=h.current();s.transactions[0].update.receipt.status='invalid';s.transactions[1].update.receipt.confirmed_changes=Array.from({length:50},()=>({character_id:'hero',field:'f',reason:'x'.repeat(500)}));assert.deepEqual(eligibleReceipts(s,{},{}),[]);
});
test('sync issued bookkeeping is cumulative, preserves pending and unrelated preference keys',async()=>{
  const h=harness(),a=h.commit('a'),b=h.commit('b');await h.mark(a);await h.mark(b);h.prefs.set('unrelated',{v:1});const offered=clone(h.prefs.get(offeredKey(a.campaign_id)));
  const rec=await h.sync.store.getSyncRecord(a.campaign_id);rec.unsentReceipts=rec.unsentReceipts.filter(r=>r.update_id!=='a');await h.sync.store.putSyncRecord(a.campaign_id,rec);
  assert.deepEqual(h.prefs.get(syncKey(a.campaign_id)).sent,[key(a)]);await h.sync.store.putSyncRecord(a.campaign_id,rec);
  assert.deepEqual((await h.sync.store.getSyncRecord(a.campaign_id)).unsentReceipts.map(r=>r.update_id),['b']);assert.deepEqual(h.prefs.get(offeredKey(a.campaign_id)),offered);assert.deepEqual(h.prefs.get('unrelated'),{v:1});
});
test('sync concurrent commit B during receipt A cannot be marked sent by A acknowledgement',async()=>{
  const h=harness(),a=h.commit('a');await h.mark(a);const entered=gate(),release=gate();
  const job=run(h,client({postReceipt:async()=>{entered.resolve();await release.promise;return ok('receipt_recorded');}}));await entered.promise;
  const b=h.commit('b');await h.mark(b);release.resolve();await job;
  assert.deepEqual(h.prefs.get(syncKey(a.campaign_id)).sent,[key(a)]);assert.deepEqual((await h.sync.store.getSyncRecord(a.campaign_id)).unsentReceipts.map(r=>r.update_id),['b']);
});
test('sync provenance collision follows preview conflict and requires matching operations identity',async()=>{
  const h=harness(),u=h.commit('x');const wrong=update(h.current(),'x',9);
  await assert.rejects(async()=>{previewUpdate(h.current(),wrong);await h.mark(wrong);},e=>e.code==='UPDATE_ID_CONFLICT');assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,0);
  assert.equal(previewUpdate(h.current(),u).status,'already_applied');await h.mark(u);assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,1);
  assert.deepEqual(eligibleReceipts(h.current(),{}, {[key(u)]:'different-operations'}),[]);
  await assert.rejects(()=>h.mark(wrong));await h.mark(u);
});
test('sync cancelled review marker alone queues nothing; identical manual commit acknowledges once',async()=>{
  const h=harness(),u=update(h.current(),'cancelled');previewUpdate(h.current(),u);await h.mark(u);assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,0);
  h.commit('cancelled');assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,1);await run(h);assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,0);
});
test('sync invalid marked receipt stays visible and blocks publication in real reconciler',async()=>{
  const h=harness(),u=h.commit('invalid');await h.mark(u);h.current().transactions[0].update.receipt.status='invalid';assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,1);
  const r=await run(h,client({publishSnapshot:async()=>assert.fail('must not publish'),postReceipt:async()=>assert.fail('must not send')}));const row=r.campaigns[0];assert.equal(row.problem,'invalid_receipt');assert.equal(row.receiptsPending,1);assert.ok(!h.prefs.get(syncKey(u.campaign_id))?.sent?.includes(key(u)));assert.equal(view({problem:row.problem,pendingReceipts:row.receiptsPending}).key,'receipt_problem');
});
test('sync pending receipts and markers survive a new adapter instance (reload)',async()=>{
  const h=harness(),u=h.commit('reload');await h.mark(u);const second=createRelaySync(h.deps);assert.equal((await second.store.getSyncRecord(u.campaign_id)).unsentReceipts[0].update_id,'reload');assert.equal(h.prefs.get(offeredKey(u.campaign_id))[key(u)],operationsKey(u.operations));
});
test('sync restored duplicate remains already_applied and ancestral receipt never queues',async()=>{
  const h=harness(),u=h.commit('old');await h.mark(u);const before=h.current(),restored=prepareRestore(backup(before),before,'Synthetic restore').next;
  const reused={...u,lineage_id:restored.lineage_id,base_revision:restored.current_revision};const result=previewUpdate(restored,reused);assert.equal(result.status,'already_applied');assert.equal(result.receipt.lineage_id,u.lineage_id);
  assert.deepEqual(eligibleReceipts(restored,{},h.prefs.get(offeredKey(u.campaign_id))),[]);
});
test('sync same-install restore preserves preferences, excludes ancestry, accepts fresh update id',async()=>{
  const h=harness(),u=h.commit('old');await h.mark(u);const restored=prepareRestore(backup(h.current()),h.current(),'Synthetic restore').next;h.campaigns.set(u.campaign_id,restored);assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,0);
  const fresh=h.commit('new');await h.mark(fresh);assert.deepEqual((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.map(r=>r.update_id),['new']);
});
test('sync fresh-install restore plain publish gets lineage_mismatch; status reveals head and explicit approval recovers publication',async()=>{
  const old=harness();old.commit('old');const restored=prepareRestore(backup(old.current()),old.current(),'Synthetic restore').next,h=harness({state:restored});assert.deepEqual((await h.sync.store.getSyncRecord(restored.campaign_id)).unsentReceipts,[]);
  const body={ok:false,code:'lineage_mismatch',active_lineage_id:'synthetic-lineage1',note:'use the explicit lineage switch'};const calls=[];let head='synthetic-lineage1';
  const real=createRelayClient({base:'https://relay.example.invalid',getCredential:async()=> 'fake-credential',setCredential:async()=>{},fetch:async(url)=>{calls.push(url);if(url.endsWith('/device/pair'))return {status:200,json:async()=>({ok:true,device_credential:'fake-credential',device_id:'synthetic-device'})};if(url.endsWith('/device/lineage-switch')){head=restored.lineage_id;return {status:200,json:async()=>({ok:true,status:'switched',active_lineage_id:head})};}if(url.includes('/device/proposals'))return {status:200,json:async()=>({ok:true,proposals:[]})};return url.includes('/device/status')?{status:200,json:async()=>({ok:true,campaign_id:'synthetic-test1',head:{lineage_id:'synthetic-lineage1'}})}:{status:409,json:async()=>clone(body)};}});
  assert.equal((await real.pair('synthetic-code')).kind,'ok');const r=await run(h,real);assert.equal(r.campaigns[0].problem,'lineage_mismatch');assert.equal(view({problem:r.campaigns[0].problem}).key,'lineage_confirm');assert.equal(h.prefs.get(syncKey(restored.campaign_id)),undefined);
  assert.equal((await real.status(restored.campaign_id)).body.head.lineage_id,'synthetic-lineage1');await h.sync.approveLineageSwitch(restored.campaign_id,'synthetic-lineage1',restored.lineage_id);const recovered=await run(h,real);assert.equal(recovered.campaigns[0].published,true);assert.equal(head,restored.lineage_id);assert.equal(calls.filter(u=>u.includes('/device/snapshot')).length,1);assert.equal(calls.filter(u=>u.includes('/device/lineage-switch')).length,1);assert.ok(!h.prefs.get(syncKey(restored.campaign_id)).lineageApproval);
});
test('sync exact lineage approval rejects wrong current lineage and is consumed after switch',async()=>{
  const h=harness();h.prefs.set(syncKey('synthetic-test1'),{published:{lineage_id:'older',revision:1,hash:'hash'},lastLineagePublished:'older',sent:[]});await assert.rejects(()=>h.sync.approveLineageSwitch('synthetic-test1','older','not-current'));
  await h.sync.approveLineageSwitch('synthetic-test1','older',h.current().lineage_id);assert.deepEqual(h.prefs.get(syncKey('synthetic-test1')).lineageApproval,{expected_lineage_id:'older',new_lineage_id:h.current().lineage_id});let switched=0;
  await run(h,client({switchLineage:async(body,expected)=>{assert.equal(expected,'older');switched++;return ok('switched');}}));assert.equal(switched,1);assert.ok(!Object.hasOwn(h.prefs.get(syncKey('synthetic-test1')),'lineageApproval'));
});

function queuedLocks(){
  const context=new AsyncLocalStorage(),tails=new Map();
  return {request(name,fn){
    const holder=context.getStore();
    if(holder?.held.has(name)){holder.reentered=true;throw Error('Nested lock detected');}
    const job=(tails.get(name)||Promise.resolve()).then(async()=>{
      const next={held:new Set([...(holder?.held||[]),name]),reentered:false};
      let timer;
      try{return await Promise.race([
        context.run(next,async()=>{const value=await fn();if(next.reentered)throw Error('Nested lock detected');return value;}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lock test timed out')),1000);})
      ]);}finally{clearTimeout(timer);}
    });
    tails.set(name,job.catch(()=>{}));return job;
  }};
}
test('sync queued locks detect reentry and serialize reconcile, approval and concurrent offer writers',async()=>{
  const locks=queuedLocks();await assert.rejects(()=>locks.request('x',()=>locks.request('x',()=>{})),/Nested lock/);
  const h=harness({locks});await run(h);const entered=gate(),release=gate(),order=[];
  const r={reconcile:async trigger=>{order.push(trigger);if(trigger==='first'){entered.resolve();await release.promise;}return {};}};
  const first=h.sync.runReconcile(r,'first');await entered.promise;const second=h.sync.runReconcile(r,'second'),approval=h.sync.approveLineageSwitch('synthetic-test1','old',h.current().lineage_id).then(()=>order.push('approved'));
  await Promise.all([h.mark(update(h.current(),'a')),h.mark(update(h.current(),'b'))]);assert.equal(Object.keys(h.prefs.get(offeredKey('synthetic-test1'))).length,2);assert.deepEqual(order,['first']);release.resolve();await Promise.all([first,second,approval]);assert.deepEqual(order,['first','second','approved']);
});
test('sync no-lock fallback serializes reconcile and approval, and each campaign offer queue',async()=>{
  const h=harness(),entered=gate(),release=gate(),order=[];const r={reconcile:async trigger=>{order.push(trigger);if(trigger==='one'){entered.resolve();await release.promise;}}};const first=h.sync.runReconcile(r,'one');await entered.promise;const second=h.sync.runReconcile(r,'two'),approval=h.sync.approveLineageSwitch('synthetic-test1','old',h.current().lineage_id).then(()=>order.push('approval'));
  await Promise.all([h.mark(update(h.current(),'a')),h.mark(update(h.current(),'b'))]);assert.equal(Object.keys(h.prefs.get(offeredKey('synthetic-test1'))).length,2);assert.deepEqual(order,['one']);release.resolve();await Promise.all([first,second,approval]);assert.deepEqual(order,['one','two','approval']);
});
test('sync enablement defaults off and disabled records remain untouched',async()=>{
  const h=harness();assert.deepEqual(await h.sync.store.listEligible(),[]);await h.sync.setEnabled('synthetic-test1',true);assert.equal((await h.sync.store.listEligible()).length,1);await h.sync.setEnabled('synthetic-test1',false);const before=clone([...h.prefs]);await h.sync.runReconcile(createReconciler({client:client(),store:h.sync.store}),'test');assert.deepEqual([...h.prefs],before);
});
test('sync forget writes null only to credential key and secret is unrecoverable through preferences',async()=>{
  const h=harness(),secret='recognizable-fake-secret';await h.sync.credential.set(secret);assert.equal(await h.sync.credential.get(),secret);h.prefs.set('unrelated',1);h.writes.length=0;await h.sync.credential.forget();assert.deepEqual(h.writes,[CREDENTIAL_KEY]);assert.equal(h.prefs.get(CREDENTIAL_KEY),null);assert.equal(await h.sync.credential.get(),null);for(const k of h.prefs.keys())assert.ok(!JSON.stringify(await h.deps.getPreference(k)).includes(secret));
});
test('sync status table covers all client/reconciler codes without mislabeling HTTP errors offline',()=>{
  const groups={device_rejected:['unauthorized','bad_credential','revoked_credential','invalid_or_used_code'],not_keeper:['not_record_keeper'],forbidden:['forbidden','forbidden_content'],offline:['offline'],receipt_problem:['invalid_receipt','receipt_conflict'],too_large:['too_large','payload_too_large'],lineage_confirm:['lineage_confirmation_required','lineage_mismatch','rejected_abandoned_lineage','switch_conflict','lineage'],outdated:['rejected_stale','stale','stale_base','rejected_superseded'],unavailable:['server','malformed_response'],unreachable:['timeout_unavailable'],other:['bad_request','conflict_same_revision','conflict','client_error','reconciliation_error','not_eligible','unknown']};
  for(const [expected,codes] of Object.entries(groups))for(const problem of codes)assert.equal(view({problem}).key,expected,problem);
  for(const status of [401,403,429,500,503]){const r=classifyResponse({status,body:{ok:false}});assert.notEqual(view({problem:r.code,online:false}).key,'offline');}
  assert.equal(view({stopped:'unauthorized'}).key,'device_rejected');assert.equal(view({stopped:'offline'}).key,'offline');assert.equal(view({paired:false}).key,'not_paired');assert.equal(view({enabled:false}).key,'disabled');assert.equal(view().key,'synced');assert.equal(view({publishedRevision:null}).key,'waiting');assert.equal(view({pendingReceipts:1}).key,'waiting');assert.equal(view({online:false}).key,'synced');for(const problem of ['too_large','payload_too_large'])assert.equal(view({problem,pendingReceipts:1}).key,'receipt_problem');
});
test('sync credential never enters display, sync metadata, or propagated error messages',async()=>{
  const h=harness(),secret='recognizable-fake-secret';await h.sync.credential.set(secret);const rec=await h.sync.store.getSyncRecord('synthetic-test1');assert.ok(!JSON.stringify(rec).includes(secret));assert.ok(!JSON.stringify(view({problem:secret})).includes(secret));
  const broken=createRelaySync({...h.deps,getPreference:async()=>{throw Error(secret);}});for(const action of [()=>broken.credential.get(),()=>broken.store.getSyncRecord('synthetic-test1'),()=>broken.markRelayUpdate('synthetic-test1','l','u','k')])await assert.rejects(action,e=>!e.message.includes(secret));
});
test('sync lineage consequence explains all four irreversible/retained-state facts',()=>{
  const text=lineageConsequenceText('Synthetic');for(const phrase of ['new authoritative history','Proposals queued against the old history will no longer apply','old history is abandoned permanently','stays saved on this device whether or not you approve'])assert.ok(text.includes(phrase));
});
test('sync terminal receipt conflict is settled while retryable receipt errors remain pending',async()=>{
  for(const code of ['receipt_conflict','rejected_superseded','server']){const h=harness(),u=h.commit('u');await h.mark(u);const r=await run(h,client({postReceipt:async()=>({...classifyResponse({status:code==='server'?503:409,body:{ok:false,code}}),body:null})}));assert.equal(r.campaigns[0].problem,code);assert.equal((await h.sync.store.getSyncRecord(u.campaign_id)).unsentReceipts.length,code==='server'?1:0);}
});

test('sync offer membership must be own, not inherited; campaign/source/update identity checks fail closed',()=>{
  const h=harness(),u=h.commit('u'),s=h.current(),map={[key(u)]:operationsKey(u.operations)};
  assert.deepEqual(eligibleReceipts(s,{},Object.create(map)),[]);
  for(const change of [t=>t.campaign_id='other',t=>t.source='manual',t=>t.update.receipt.update_id='other']){const bad=clone(s);change(bad.transactions[0]);assert.deepEqual(eligibleReceipts(bad,{},map),[]);}
});
test('sync oversized marked receipt is retained and reported invalid_receipt before transport',async()=>{
  const h=harness(),u=h.commit('huge');await h.mark(u);h.current().transactions[0].update.receipt.confirmed_changes=Array.from({length:50},()=>({character_id:'hero',field:'f',reason:'x'.repeat(500)}));
  const r=await run(h,client({postReceipt:async()=>assert.fail('projection must stop oversized receipt'),publishSnapshot:async()=>assert.fail('must not publish')}));assert.equal(r.campaigns[0].problem,'invalid_receipt');assert.equal(r.campaigns[0].receiptsPending,1);
});
