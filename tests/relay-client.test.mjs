import test from 'node:test';
import assert from 'node:assert/strict';
import {validateState} from '../dist/core.js';
import {previewUpdate} from '../dist/updates.js';
import {hashPayload} from '../dist/relay-projection.js';
import {proposalToUpdate, projectReceipt, buildSnapshotRequest} from '../dist/relay-client.js';

function fixture(id = 'synthetic-test1') {
  return validateState({schema_version:2,campaign_id:id,lineage_id:'synthetic-lineage1',display_name:'Synthetic campaign',system_label:'Synthetic',current_day:1,day_label:{singular:'day',plural:'days'},day_zero_note:'',resources:[],currency:{id:'coins',label:'Coins'},level_thresholds:{},ability_slots_enabled:false,current_revision:1,characters:[{character_id:'synthetic-owner',campaign_id:id,name:'Synthetic owner',level:1,xp_total:0,resources:[],currency_amount:10,attributes:[],profile:{},inventory:[],reference_revision:0}],journal:[],transactions:[],sessions:[],recovery:[],pending_migration:null});
}
const proposal = () => ({update_id:'synthetic-update',lineage_id:'synthetic-lineage1',base_revision:1,payload_hash:'synthetic-hash',operations:[{op:'adjust_currency',reason:'Synthetic change',character_id:'synthetic-owner',args:{delta:5}}]});
const receipt = () => ({format:'scroll-update-receipt',version:1,campaign_id:'synthetic-test1',lineage_id:'synthetic-lineage1',update_id:'synthetic-update',current_revision:2,current_day:1,status:'applied',app_version:'synthetic-version',interruption:null,confirmed_changes:[{character_id:'synthetic-owner',field:'currency_amount',reason:'Synthetic change',from:10,to:15}]});

test('relay proposal flattens args, preserves effective_day and uses existing review validation', () => {
  const s=fixture(),p=proposal(),before=structuredClone({s,p});p.operations[0].args.effective_day=1;
  const adapted=proposalToUpdate(p,s);assert.equal(adapted.ok,true);assert.deepEqual(adapted.update.operations,[{op:'adjust_currency',reason:'Synthetic change',character_id:'synthetic-owner',delta:5,effective_day:1}]);
  const reviewed=previewUpdate(s,adapted.update);assert.equal(reviewed.next.characters[0].currency_amount,15);assert.equal(s.characters[0].currency_amount,10);
  delete p.operations[0].args.effective_day;assert.deepEqual({s,p},before);
  p.operations[0].op='future_operation';assert.equal(proposalToUpdate(p,s).ok,true);assert.throws(()=>previewUpdate(s,proposalToUpdate(p,s).update));
});
test('relay proposal rejects collisions, nested/nonfinite args, wrong lineage and stale base', () => {
  for(const key of ['op','reason','character_id']){const p=proposal();p.operations[0].args[key]='collision';assert.equal(proposalToUpdate(p,fixture()).reason,'arg_collision');}
  for(const value of [{nested:true},[],null,undefined,Infinity,NaN,()=>{}]){const p=proposal();p.operations[0].args.delta=value;assert.equal(proposalToUpdate(p,fixture()).reason,'invalid_args');}
  const p=proposal();p.lineage_id='other';assert.equal(proposalToUpdate(p,fixture()).reason,'wrong_lineage');p.lineage_id='synthetic-lineage1';p.base_revision=0;assert.equal(proposalToUpdate(p,fixture()).reason,'stale_base');
});
test('relay receipt allowlist removes sentinels at every retained object depth', () => {
  const r=receipt();Object.assign(r,{unknown:'TOP_SECRET',day_tokens:['TOKEN_SECRET'],event_id_mapping:[{id:'ALIAS_SECRET'}],pending_changes:'PENDING_SECRET',chain_records_pending:999});Object.assign(r.confirmed_changes[0],{from:{secret:'FROM_SECRET'},to:'TO_SECRET',extra:'CHANGE_SECRET'});r.interruption={day_reached:1,token:'public-token',instruction:'INTERRUPTION_SECRET'};
  const before=structuredClone(r),p=projectReceipt(r),serialized=JSON.stringify(p);assert.ok(p);assert.ok(!/SECRET/.test(serialized));assert.deepEqual(p.interruption,{day_reached:1,token:'public-token'});assert.deepEqual(p.confirmed_changes,[{character_id:'synthetic-owner',field:'currency_amount',reason:'Synthetic change'}]);assert.deepEqual(r,before);
  for(const key of ['from','to','day_tokens','event_id_mapping','pending_changes','chain_records_pending','unknown'])assert.ok(!serialized.includes('"'+key+'"'));
});
test('relay receipt caps entries and code points, preserves campaign-level null owner', () => {
  const r=receipt();r.confirmed_changes=Array.from({length:51},()=>({character_id:null,field:'f',reason:'r'}));const p=projectReceipt(r);assert.equal(p.confirmed_changes.length,50);assert.equal(p.confirmed_changes_omitted,1);assert.equal(p.confirmed_changes[0].character_id,null);
  r.confirmed_changes=[{character_id:null,field:'f',reason:'😀'.repeat(501)}];assert.equal(Array.from(projectReceipt(r).confirmed_changes[0].reason).length,500);
  r.status='interrupted';assert.equal(projectReceipt(r).status,'interrupted');delete r.app_version;assert.ok(!Object.hasOwn(projectReceipt(r),'app_version'));
});
test('relay receipt invalid status or oversized serialized content returns null', () => {
  const r=receipt();r.status='queued';assert.equal(projectReceipt(r),null);r.status='applied';r.confirmed_changes=Array.from({length:50},()=>({character_id:null,field:'f',reason:'😀'.repeat(500)}));assert.equal(projectReceipt(r),null);
});
test('relay snapshot request uses exact canonical payload and authoritative display_name', async () => {
  const s=fixture(),before=structuredClone(s),r=await buildSnapshotRequest(s,{labelOf:()=>{throw Error('Must not replace authoritative label');}});assert.equal(r.ok,true);assert.equal(r.body.label,s.display_name);assert.equal(r.body.projection_hash,await hashPayload(r.body.payload));assert.equal(r.body.projection_version,1);assert.equal(r.body.revision,s.current_revision);assert.equal(r.bytes,new TextEncoder().encode(JSON.stringify(r.body)).length);assert.deepEqual(s,before);
});
test('relay snapshot ineligible and oversized states return no request body', async () => {
  const s=fixture();s.display_name='x'.repeat(101);const denied=await buildSnapshotRequest(s);assert.deepEqual(denied,{ok:false,code:'not_eligible'});s.display_name='Synthetic';s.characters[0].profile.notes='x'.repeat(50000);assert.deepEqual(await buildSnapshotRequest(s),{ok:false,code:'too_large'});
});

import {classifyResponse, createRelayClient, createReconciler} from '../dist/relay-client.js';
const reply=(kind='ok',code='accepted',body={})=>({kind,code,retry:['offline','server'].includes(kind),body});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('relay classification covers success and every error row',()=>{
  for(const [status,code,kind] of [[401,'bad_credential','unauthorized'],[403,'not_record_keeper','not_record_keeper'],[409,'rejected_stale','stale'],...[ 'lineage_mismatch','rejected_abandoned_lineage','switch_conflict'].map(c=>[409,c,'lineage']),...['conflict_same_revision','receipt_conflict','rejected_superseded'].map(c=>[409,c,'conflict']),[413,'payload_too_large','too_large'],[422,'forbidden_content','forbidden'],[500,'server','server'],[503,'server','server'],[400,'bad_request','bad_request'],[404,'bad_request','bad_request'],[418,'server','server']]) {
    const r=classifyResponse({status,body:{ok:false,code}});assert.equal(r.kind,kind);assert.equal(r.retry,kind==='server');
  }
  for(const status of ['accepted','switched','receipt_recorded','duplicate_ok'])assert.deepEqual(classifyResponse({status:200,body:{ok:true,status}}),{kind:status==='duplicate_ok'?'duplicate_ok':'ok',code:status,retry:false});
  assert.equal(classifyResponse({networkError:true}).kind,'offline');assert.equal(classifyResponse({status:200,body:{ok:false}}).kind,'server');
});

test('relay client settings, all endpoints, timeout injection and secret confinement',async()=>{
  const calls=[],secret='synthetic-device-secret',signal=new AbortController().signal;let reads=0,saved;
  const client=createRelayClient({base:'https://relay.example.invalid',now:()=>0,getCredential:()=>{reads++;return secret;},setCredential:v=>{saved=v;},timeoutSignal:ms=>{assert.equal(ms,15000);return signal;},fetch:async(url,options)=>{
    calls.push({url,options});const path=new URL(url).pathname;
    return {status:200,json:async()=>path.endsWith('/pair')?{ok:true,device_id:'synthetic-device',device_credential:secret}:path.endsWith('/snapshot')?{ok:true,status:'accepted',revision:1}:path.endsWith('/lineage-switch')?{ok:true,status:'switched',active_lineage_id:'new'}:path.endsWith('/receipt')?{ok:true,status:'receipt_recorded',update_id:'u'}:path.endsWith('/proposals')?{ok:true,proposals:[]}:{ok:true,device_id:'synthetic-device'}};
  }});
  const snapshot=(await buildSnapshotRequest(fixture())).body;
  const results=[await client.pair('one-use'),await client.ping(),await client.status('synthetic test&'),await client.publishSnapshot(snapshot),await client.switchLineage(snapshot,'old'),await client.fetchProposals('synthetic-test1'),await client.postReceipt({campaign_id:'synthetic-test1',lineage_id:'synthetic-lineage1',update_id:'synthetic-update',committed_revision:2,receipt:projectReceipt(receipt())})];
  assert.equal(saved,secret);assert.equal(reads,6);assert.ok(!JSON.stringify(results).includes(secret));
  for(const {url,options} of calls){assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.signal,signal);assert.ok(!url.includes(secret));assert.ok(!options.body?.includes(secret));assert.equal(options.headers.Authorization,url.endsWith('/pair')?undefined:'Bearer '+secret);}
  assert.ok(calls[2].url.endsWith('campaign_id=synthetic%20test%26'));
  const switched=JSON.parse(calls[4].options.body);assert.equal(switched.new_lineage_id,snapshot.lineage_id);assert.equal(switched.expected_lineage_id,'old');assert.ok(!Object.hasOwn(switched,'lineage_id'));
  for(const base of ['http://relay.example.invalid','https://relay.example.invalid/','https://relay.example.invalid/path','https://user@relay.example.invalid','https://relay.example.invalid?x=1'])assert.throws(()=>createRelayClient({base}));
});

test('relay client failures never disclose credentials and malformed JSON preserves HTTP auth',async()=>{
  const secret='synthetic-secret';let stored=0;
  for(const mode of ['throw','echo','json','unauthorized','pair-fail']){
    const client=createRelayClient({base:'https://relay.example.invalid',getCredential:()=>secret,setCredential:()=>stored++,fetch:async()=>{if(mode==='throw')throw Error(secret);return {status:['unauthorized','pair-fail'].includes(mode)?401:200,json:async()=>{if(mode==='json'||mode==='unauthorized')throw Error(secret);return mode==='echo'?{ok:true,echo:secret}:{ok:false,code:'invalid_or_used_code'};}};}});
    const r=mode==='pair-fail'?await client.pair('bad'):await client.ping();assert.ok(!JSON.stringify(r).includes(secret));assert.equal(r.kind,mode==='throw'?'offline':['unauthorized','pair-fail'].includes(mode)?'unauthorized':'server');
  }assert.equal(stored,0);
});

function rig({states=[fixture()],record,handlers={}}={}){
  const records=new Map(states.map(s=>[s.campaign_id,structuredClone(record||{published:null,unsentReceipts:[],lastLineagePublished:null})]));const calls=[];let pending=0,passes=0,writes=0;
  const client=Object.fromEntries(['postReceipt','publishSnapshot','switchLineage','fetchProposals'].map(method=>[method,async(...args)=>{calls.push({method,args});pending++;try{return handlers[method]?await handlers[method](...args):reply('ok',method==='postReceipt'?'receipt_recorded':method==='switchLineage'?'switched':method==='fetchProposals'?'ok':'accepted',method==='fetchProposals'?{proposals:[proposal()]}:{});}finally{pending--;}}]));
  const store={listEligible:async()=>{passes++;return states.map(state=>({campaign_id:state.campaign_id,state}));},getSyncRecord:async id=>structuredClone(records.get(id)),putSyncRecord:async(id,r)=>{assert.equal(pending,0,'write during network');writes++;records.set(id,structuredClone(r));}};
  return {reconciler:createReconciler({client,store,now:()=>0}),records,calls,get passes(){return passes;},get writes(){return writes;}};
}
const queued=()=>({update_id:'synthetic-update',lineage_id:'synthetic-lineage1',committed_revision:2,receipt:receipt()});
const withReceipt=()=>({published:null,unsentReceipts:[queued()],lastLineagePublished:null});

test('reconciler sends safe receipts before snapshot then returns raw proposals without writing campaign state',async()=>{
  const s=fixture(),before=structuredClone(s),r=rig({states:[s],record:withReceipt()}),out=await r.reconciler.reconcile('commit');
  assert.deepEqual(r.calls.map(c=>c.method),['postReceipt','publishSnapshot','fetchProposals']);assert.deepEqual(s,before);assert.equal(out.campaigns[0].receiptsSent,1);assert.equal(out.campaigns[0].receiptsPending,0);assert.equal(out.campaigns[0].published,true);assert.equal(out.campaigns[0].problem,null);assert.deepEqual(out.campaigns[0].proposals,[proposal()]);assert.ok(!Object.hasOwn(r.calls[0].args[0].receipt.confirmed_changes[0],'from'));assert.equal(proposalToUpdate(out.campaigns[0].proposals[0],s).ok,true);
});
test('reconciler single flight shares promise and runs at most one dirty followup',async()=>{
  const gate=deferred(),r=rig({handlers:{publishSnapshot:async()=>{await gate.promise;return reply();}}});const jobs=Array.from({length:5},()=>r.reconciler.reconcile('focus'));assert.ok(jobs.every(j=>j===jobs[0]));gate.resolve();await Promise.all(jobs);assert.equal(r.passes,2);assert.equal(r.calls.filter(c=>c.method==='publishSnapshot').length,1);
});
test('reconciler unauthorized stops all, forbidden stops only one, offline never marks published',async()=>{
  for(const kind of ['unauthorized','not_record_keeper','offline']){
    const r=rig({states:[fixture(),fixture('synthetic-test2')],handlers:{publishSnapshot:async body=>body.campaign_id==='synthetic-test1'?reply(kind,kind):reply()}}),out=await r.reconciler.reconcile('focus');
    assert.equal(out.stopped,kind==='not_record_keeper'?null:kind);assert.equal(r.records.get('synthetic-test1').published,null);assert.equal(r.calls.filter(c=>c.method==='publishSnapshot').length,kind==='not_record_keeper'?2:1);
  }
});
test('reconciler lineage switch requires exact stored human approval and consumes it on success',async()=>{
  for(const approval of [undefined,{expected_lineage_id:'wrong',new_lineage_id:'synthetic-lineage1'},{expected_lineage_id:'old',new_lineage_id:'synthetic-lineage1'}]){
    const r=rig({record:{published:{lineage_id:'old',revision:8,hash:'oldhash'},lastLineagePublished:'old',unsentReceipts:[],lineageApproval:approval}}),out=await r.reconciler.reconcile('restore');
    if(approval?.expected_lineage_id==='old'){assert.equal(r.calls[0].method,'switchLineage');assert.equal(r.calls[0].args[1],'old');assert.ok(!r.records.get('synthetic-test1').lineageApproval);assert.equal(out.campaigns[0].published,true);}
    else{assert.equal(out.campaigns[0].problem,'lineage_confirmation_required');assert.equal(r.calls.length,0);}
  }
});
test('reconciler duplicate receipt and permanent receipt conflict are removed without loops',async()=>{
  for(const [kind,code] of [['duplicate_ok','duplicate_ok'],['conflict','receipt_conflict']]){
    const r=rig({record:withReceipt(),handlers:{postReceipt:async()=>reply(kind,code)}}),out=await r.reconciler.reconcile('retry');assert.equal(out.campaigns[0].receiptsPending,0);assert.equal(out.campaigns[0].problem,kind==='conflict'?code:null);await r.reconciler.reconcile('retry');assert.equal(r.calls.filter(c=>c.method==='postReceipt').length,1);
  }
});
test('reconciler retryable receipt failure keeps queue and blocks newer snapshot',async()=>{
  for(const kind of ['server','offline','unauthorized','not_record_keeper']){const r=rig({record:withReceipt(),handlers:{postReceipt:async()=>reply(kind,kind)}}),out=await r.reconciler.reconcile('retry');assert.equal(out.campaigns[0].receiptsPending,1);assert.deepEqual(r.calls.map(c=>c.method),['postReceipt']);assert.equal(r.records.get('synthetic-test1').unsentReceipts.length,1);}
});
test('reconciler does not publish stale or conflicting same-revision captured state',async()=>{
  for(const revision of [1,2]){const r=rig({record:{published:{lineage_id:'synthetic-lineage1',revision,hash:'different'},unsentReceipts:[],lastLineagePublished:'synthetic-lineage1'}}),out=await r.reconciler.reconcile('focus');assert.equal(r.calls.length,0);assert.equal(out.campaigns[0].problem,revision===1?'conflict_same_revision':'rejected_stale');}
});

test('relay client rejects wrong endpoint success status and oversized receipts before fetch',async()=>{
  let calls=0;const client=createRelayClient({base:'https://relay.example.invalid',getCredential:()=> 'synthetic-secret',fetch:async()=>{calls++;return {status:200,json:async()=>({ok:true,status:'switched'})};}});
  assert.equal((await client.publishSnapshot({})).code,'malformed_response');assert.equal((await client.postReceipt({receipt:'x'.repeat(8192)})).kind,'too_large');assert.equal(calls,1);
});

test('reconciler dirty followup retains first-pass acknowledgements in its result',async()=>{
  const gate=deferred(),r=rig({record:withReceipt(),handlers:{postReceipt:async()=>{await gate.promise;return reply('ok','receipt_recorded');}}});
  const first=r.reconciler.reconcile('commit');r.reconciler.reconcile('focus');gate.resolve();const result=await first;
  assert.equal(result.campaigns[0].published,true);assert.equal(result.campaigns[0].receiptsSent,1);assert.equal(result.campaigns[0].receiptsPending,0);
});
