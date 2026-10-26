import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateState, migrateState, backup} from '../dist/core.js';
import {dayToken, DAY_COUNT} from '../dist/progress.js';
import {RELAY_PROJECTION_VERSION, TOKEN_TAIL, PAYLOAD_BUDGET, relayAdmission, canonicalJson, buildRelayProjection, hashPayload} from '../dist/relay-projection.js';

const size = x => new TextEncoder().encode(x).length;
function fixture() {
  const campaign_id = '00000000-0000-4000-8000-000000000001', owner = 'synthetic-owner';
  const event = {id:'sealed-id', visibility:'dm_only', label:null, eligible_from_day:100, must_fire_by_day:110, fires_on_day:105, selection_rule:'random', state:'scheduled', triggered_on_day:null, processed_on_day:null, deliveries:[], resolved_at:null, revisions:[]};
  const s = {schema_version:2, campaign_id, lineage_id:'00000000-0000-4000-8000-000000000002', display_name:'PRIVATE_FIXTURE_TEXT', system_label:'Synthetic system', current_day:20, day_label:{singular:'day',plural:'days'}, day_zero_note:'Synthetic zero', resources:[{id:'hp',label:'HP'}], currency:{id:'coin',label:'Coins'}, level_thresholds:{1:'unknown',2:50}, ability_slots_enabled:true, current_revision:1,
    characters:[{character_id:owner,campaign_id,name:'PRIVATE_OWNER_TEXT',player_note:'Synthetic player note',level:1,xp_total:0,resources:[{id:'hp',current:12,max:10}],currency_amount:5,attributes:[{key:'a',label:'A',value:'unknown',note:''}],profile:{concept:'Synthetic',motivation:'Synthetic',notes:'PRIVATE_PROFILE_TEXT',details:[{key:'detail',value:'literal'}]},ability_slots:[{index:1,name:null,applications:['Legacy literal',{name:'Synthetic art',status:'in_development',cost:'not yet quantified',range:'touch',effect:'literal',notes:'not yet quantified',threshold_id:'training'}]},{index:2,name:null}],inventory:[{item:'PRIVATE_ITEM_TEXT',qty:2,consumable:true,notes:'Synthetic'}],reference_revision:0}],
    roster:[{roster_id:'member',owner_character_id:owner,status:'active',species:'Synthetic species',nickname:'',level:1,xp_total:0,resources:[{id:'hp',current:3,max:5}],stats:Array.from({length:6},(_,i)=>({key:'stat'+i,label:'Stat '+i,value:1})),moves:[{move_id:'move',name:'Move',type:'Literal',category:'Special',power:null,accuracy:'not yet quantified',pp_current:1,pp_max:2,effect:'Literal'}],attributes:[{key:'roster-attribute',label:'Roster attribute',value:-1}],ability:'Literal',bond:'Trusted',held_item:null,status_condition:{name:'Synthetic',duration_remaining:null,duration_unit:'turns'}}],roster_config:{label:'Roster',hide_owner_stats:false},roster_level_thresholds:{1:'unknown',2:25},
    thresholds:[{id:'training',character_id:owner,label:'Synthetic training',completed_on_day:'unknown',stages:[{stage_index:0,required:10,consecutive_required:false,baseline:{successes:'unknown',streak:'unknown',note:'PRIVATE_BASELINE_NOTE'},dc_revisions:[{revision_id:'old-dc',dc:7,set_on_day:'unknown'},{revision_id:'current-dc',dc:8,set_on_day:10}],attempts:[{attempt_seq:1,result:'failure',dc_revision_id:'current-dc',superseded:false}]}]}],
    scheduler:{version:1,stream:'abcdef12'.repeat(DAY_COUNT),cover:'0'.repeat(DAY_COUNT),remainder:{target_day:30},events:[event,{...event,id:'visible-id',state:'triggered',eligible_from_day:10,must_fire_by_day:10,fires_on_day:10,triggered_on_day:10,processed_on_day:20},{...event,id:'chain-id',selection_rule:'trigger_chain',eligible_from_day:null,must_fire_by_day:null,fires_on_day:null,depends_on_id:'sealed-id'}]},
    transactions:[{transaction_id:'tx',campaign_id,timestamp:'2026-01-01T00:00:00Z',in_world_day:20,source:'manual',reason:'PRIVATE_TRANSACTION_REASON',base_revision:0,operations:[{op:'advance_day',to_day:20}],journal_seqs:[1]}],
    journal:[{journal_seq:1,transaction_id:'tx',campaign_id,timestamp:'2026-01-01T00:00:00Z',in_world_day:20,character_id:null,entity:'campaign',entity_id:campaign_id,field:'current_day',from:10,to:20,reason:'PRIVATE_JOURNAL_REASON',source:'manual'}],
    sessions:[{session_id:'session',campaign_id,opened_at:'2026-01-01T00:00:00Z',closed_at:null,opening_day:10,closing_day:null,state:'open',notes:'Synthetic notes',advance_submitted:true}],recovery:[],pending_migration:null};
  return validateState(s);
}
function built(s = fixture()) { const r = buildRelayProjection(s); assert.equal(r.ok, true); return r; }
function walk(v, visit) { if (!v || typeof v !== 'object') return; visit(v); for (const x of Object.values(v)) walk(x, visit); }
function advanceFixture(days) { const s=fixture();s.current_day=days;s.journal[0].from=0;s.journal[0].to=days;s.journal[0].in_world_day=days;s.transactions[0].in_world_day=days;s.transactions[0].operations[0].to_day=days;return validateState(s); }

test('relay allowlist: nested unknown fields and sealed sentinels never escape', () => {
  const s=fixture(), original=built(s).payload;
  // Deliberately add unknown fields after validation: projection must not spread records.
  walk(s, o=>{if(!Array.isArray(o))o.UNAPPROVED_SENTINEL='NESTED_SECRET_SENTINEL';});
  s.scheduler.stream=s.scheduler.stream.slice(0,90000)+'PRIVATE_STREAM_SENTINEL'+s.scheduler.stream.slice(90022);
  s.scheduler.cover='PRIVATE_COVER_SENTINEL';
  Object.assign(s.scheduler.events[0],{id:'PRIVATE_EVENT_ID',eligible_from_day:'PRIVATE_WINDOW_START',must_fire_by_day:'PRIVATE_WINDOW_END',fires_on_day:'PRIVATE_FIRE_DAY',selection_rule:'PRIVATE_SELECTION_RULE'});
  s.journal[0].reason='PRIVATE_JOURNAL_REASON';s.transactions[0].reason='PRIVATE_TRANSACTION_REASON';
  s.recovery=[{reason:'PRIVATE_RECOVERY_SENTINEL'}];
  // Existing boolean changes intentionally; contents must not be disclosed.
  s.pending_migration={secret:'PRIVATE_MIGRATION_SENTINEL'};
  const r=built(s);assert.equal(r.data.pending_migration,true);
  assert.equal(r.payload,canonicalJson({...JSON.parse(original),pending_migration:true}));
  for(const word of ['UNAPPROVED_SENTINEL','NESTED_SECRET_SENTINEL','PRIVATE_STREAM_SENTINEL','PRIVATE_COVER_SENTINEL','PRIVATE_EVENT_ID','PRIVATE_WINDOW_START','PRIVATE_WINDOW_END','PRIVATE_FIRE_DAY','PRIVATE_SELECTION_RULE','PRIVATE_JOURNAL_REASON','PRIVATE_TRANSACTION_REASON','PRIVATE_RECOVERY_SENTINEL','PRIVATE_MIGRATION_SENTINEL','PRIVATE_BASELINE_NOTE','old-dc']) assert.ok(!r.payload.includes(word),word);
  const forbidden=['scheduler','journal','transactions','recovery','stream','cover','fires_on_day','eligible_from_day','must_fire_by_day','attempts','dc_revisions'];
  walk(r.data,o=>{for(const k of Object.keys(o))assert.ok(!forbidden.includes(k),k);});
});
test('relay sealed-metadata invariance includes event identity, schedule and hidden count', () => {
  const s=fixture(), first=built(s).payload;
  Object.assign(s.scheduler.events[0],{id:'different-sealed-id',eligible_from_day:300,must_fire_by_day:900,fires_on_day:900,selection_rule:'last_day'});
  s.scheduler.events.push({...s.scheduler.events[0],id:'another-sealed-id'});
  validateState(s);assert.equal(built(s).payload,first);
});
test('relay determinism, shuffled object keys, exact hashing and nonmutation', async () => {
  const s=fixture(), before=structuredClone(s), r=built(s);
  const shuffle=v=>Array.isArray(v)?v.map(shuffle):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,shuffle(x)])):v;
  assert.equal(built(s).payload,r.payload);assert.equal(built(shuffle(s)).payload,r.payload);assert.equal(built(structuredClone(s)).payload,r.payload);
  assert.equal(await hashPayload(r.payload),await hashPayload(built(s).payload));assert.deepEqual(s,before);
  assert.equal(r.payload_bytes,size(r.payload));assert.equal(r.sections['characters[0].profile'],size(canonicalJson(r.data.characters[0].profile)));
  assert.equal(r.sections['characters[0].ability_slots'],size(canonicalJson(r.data.characters[0].ability_slots)));
});
test('relay legacy migration and documented literal variants are preserved', () => {
  const s=fixture();s.schema_version=1;delete s.roster[0].attributes;s.thresholds[0].stages[0].dc_revisions=[];s.thresholds[0].stages[0].attempts=[];
  validateState(s);const r=built(s);assert.equal(r.payload,built(migrateState(s)).payload);assert.deepEqual(r.data.roster[0].attributes,[]);
  assert.equal(r.data.thresholds[0].stages[0].current_dc,null);assert.equal(r.data.characters[0].ability_slots[0].applications[0],'Legacy literal');
  assert.equal(r.data.characters[0].ability_slots[0].name,null);assert.equal(r.data.thresholds[0].completed_on_day,'unknown');
  assert.equal(r.data.thresholds[0].stages[0].progress.successes,'unknown');assert.equal(r.data.campaign.level_thresholds['1'],'unknown');assert.equal(r.data.roster_level_thresholds['1'],'unknown');
  for(const value of [null,20]){s.thresholds[0].completed_on_day=value;assert.equal(built(s).data.thresholds[0].completed_on_day,value);}
  s.thresholds[0].stages[0].dc_revisions=[{revision_id:'dc',dc:4,set_on_day:'unknown'}];assert.equal(built(s).data.thresholds[0].stages[0].current_dc.set_on_day,'unknown');
});
test('relay absent optionals, absent scheduler/history and defaults stay explicit', () => {
  const s=fixture();delete s.scheduler;delete s.roster;delete s.roster_config;delete s.roster_level_thresholds;delete s.thresholds;s.transactions=[];s.journal=[];s.sessions=[];
  delete s.characters[0].player_note;delete s.characters[0].profile.notes;delete s.characters[0].profile.details;delete s.characters[0].attributes[0].note;delete s.characters[0].inventory[0].notes;
  s.ability_slots_enabled=false;delete s.characters[0].ability_slots;validateState(s);
  const d=built(s).data;assert.equal(d.campaign.day_token,null);assert.equal(d.last_advance,null);assert.equal(d.open_session,null);assert.equal(d.pending_remainder,null);assert.equal(d.chain_records_pending,0);assert.deepEqual(d.roster_config,{label:'Roster'});
  assert.ok(!Object.hasOwn(d.characters[0],'ability_slots'));assert.ok(!Object.hasOwn(d.characters[0],'player_note'));assert.ok(!Object.hasOwn(d.characters[0].profile,'notes'));
});
test('relay admission enforces byte/code-point limits without changing input', () => {
  const s=fixture();assert.deepEqual(relayAdmission(s),{ok:true});
  for(const [key,value,code] of [['campaign_id','a'.repeat(65),'campaign_id_limit'],['campaign_id','é'.repeat(33),'campaign_id_limit'],['lineage_id','bad/lineage','lineage_id_format'],['lineage_id','a'.repeat(65),'lineage_id_format'],['display_name','😀'.repeat(101),'display_name_limit'],['display_name','x'.repeat(101),'display_name_limit']]){const v=structuredClone(s);v[key]=value;const copy=structuredClone(v);assert.ok(relayAdmission(v).reasons.includes(code));assert.deepEqual(v,copy);assert.equal(buildRelayProjection(v).code,'not_relay_eligible');}
  s.display_name='😀'.repeat(100);assert.deepEqual(relayAdmission(s),{ok:true});assert.equal(built(s).data.identity.display_name,s.display_name);
  s.campaign_id='é'.repeat(32);assert.equal(relayAdmission(s).ok,true);
});
test('relay Unicode admission checks projected strings only, with older-browser fallback', () => {
  const original=Object.getOwnPropertyDescriptor(String.prototype,'isWellFormed');
  try{for(const fallback of [false,true]){if(fallback)Object.defineProperty(String.prototype,'isWellFormed',{value:undefined,configurable:true});
    for(const text of ['\ud800','\udc00','x\ud800y','x\udc00y']){const s=fixture();s.characters[0].profile.notes=text;assert.ok(relayAdmission(s).reasons.includes('invalid_unicode'));assert.throws(()=>canonicalJson({x:text}),/invalid_unicode/);}
    const s=fixture();s.characters[0].profile.notes='😀';s.scheduler.events[0].alias='\ud800';assert.equal(relayAdmission(s).ok,true);
  }}finally{if(original)Object.defineProperty(String.prototype,'isWellFormed',original);else delete String.prototype.isWellFormed;}
});
test('relay budget rejects whole payload, and 1000-day advances expose only final 16 tokens', () => {
  assert.equal(RELAY_PROJECTION_VERSION,1);assert.equal(TOKEN_TAIL,16);assert.equal(PAYLOAD_BUDGET,46000);
  const s=advanceFixture(1000), r=built(s);assert.ok(r.payload_bytes<10000);const a=r.data.last_advance;
  assert.equal(a.token_count,1000);assert.equal(a.tokens_tail.length,16);assert.equal(a.omitted_count,984);assert.deepEqual(a.tokens_tail,Array.from({length:16},(_,i)=>dayToken(s,985+i)));
  s.characters[0].profile.notes='x'.repeat(50000);validateState(s);const large=buildRelayProjection(s);assert.equal(large.code,'too_large');assert.ok(large.payload_bytes>46000);assert.ok(!('payload' in large));assert.ok(!('data' in large));assert.ok(large.sections['characters[0].profile']>50000);
});
test('relay identity binds revision and restored lineage into hash', async () => {
  const s=fixture(), h=await hashPayload(built(s).payload);s.current_revision++;assert.notEqual(await hashPayload(built(s).payload),h);s.current_revision--;s.lineage_id='restored-lineage';assert.notEqual(await hashPayload(built(s).payload),h);
});
test('relay budget boundary admits exactly 46000 bytes and rejects one byte more', () => {
  const s=fixture();s.characters[0].profile.notes='';const base=built(s).payload_bytes;
  s.characters[0].profile.notes='x'.repeat(PAYLOAD_BUDGET-base);validateState(s);assert.equal(built(s).payload_bytes,PAYLOAD_BUDGET);
  s.characters[0].profile.notes+='x';const rejected=buildRelayProjection(s);assert.equal(rejected.code,'too_large');assert.equal(rejected.payload_bytes,PAYLOAD_BUDGET+1);assert.ok(!('payload' in rejected));
});
test('relay attempt growth is bounded to count digits and computed current status', () => {
  const s=fixture(), g=s.thresholds[0].stages[0];g.baseline={successes:0,streak:0,note:''};
  const attempts=n=>Array.from({length:n},(_,i)=>({attempt_seq:i+1,result:'failure',dc_revision_id:'current-dc',superseded:false,secret:'ATTEMPT_SENTINEL'}));
  g.attempts=attempts(5);const a=built(s);g.attempts=attempts(5000);const b=built(s);assert.equal(b.payload_bytes-a.payload_bytes,3);assert.equal(b.data.thresholds[0].stages[0].attempt_count,5000);assert.ok(!b.payload.includes('ATTEMPT_SENTINEL'));
  g.attempts=[{result:'success',dc_revision_id:'current-dc',superseded:true},{result:'success',dc_revision_id:'current-dc',superseded:false}];assert.equal(built(s).data.thresholds[0].stages[0].progress.successes,1);
});
// Published RFC 8785 §3.2.2 / §3.2.3 and Appendix B vectors (offline constants).
test('canonical JSON matches RFC 8785 serialization and UTF-16 sorting vectors', () => {
  const input={numbers:[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],string:"€$\u000f\nA'B\"\\\\\"/",literals:[null,true,false]};
  assert.equal(canonicalJson(input),String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`);
  const sorted={'€':'Euro Sign','\r':'Carriage Return','דּ':'Hebrew Letter Dalet With Dagesh','1':'One','😀':'Emoji: Grinning Face','\u0080':'Control','ö':'Latin Small Letter O With Diaeresis'};
  assert.equal(canonicalJson(sorted),'{'+['\r','1','\u0080','ö','€','😀','דּ'].map(k=>JSON.stringify(k)+':'+JSON.stringify(sorted[k])).join(',')+'}');
  assert.equal(canonicalJson({'2':2,'10':10}),'{"10":10,"2":2}');
});
test('canonical JSON matches RFC 8785 Appendix B IEEE-754 vectors', () => {
  const vectors=[['0000000000000000','0'],['8000000000000000','0'],['0000000000000001','5e-324'],['8000000000000001','-5e-324'],['7fefffffffffffff','1.7976931348623157e+308'],['ffefffffffffffff','-1.7976931348623157e+308'],['4340000000000000','9007199254740992'],['c340000000000000','-9007199254740992'],['4430000000000000','295147905179352830000'],['44b52d02c7e14af5','9.999999999999997e+22'],['44b52d02c7e14af6','1e+23'],['44b52d02c7e14af7','1.0000000000000001e+23'],['444b1ae4d6e2ef4e','999999999999999700000'],['444b1ae4d6e2ef4f','999999999999999900000'],['444b1ae4d6e2ef50','1e+21'],['3eb0c6f7a0b5ed8c','9.999999999999997e-7'],['3eb0c6f7a0b5ed8d','0.000001'],['41b3de4355555553','333333333.3333332'],['41b3de4355555554','333333333.33333325'],['41b3de4355555555','333333333.3333333'],['41b3de4355555556','333333333.3333334'],['41b3de4355555557','333333333.33333343'],['becbf647612f3696','-0.0000033333333333333333'],['43143ff3c1cb0959','1424953923781206.2']];
  for(const [hex,expected] of vectors)assert.equal(canonicalJson(Buffer.from(hex,'hex').readDoubleBE()),expected,hex);
  for(const hex of ['7fffffffffffffff','7ff0000000000000'])assert.throws(()=>canonicalJson(Buffer.from(hex,'hex').readDoubleBE()));
});
test('canonical JSON rejects non-JSON values anywhere without invoking object hooks', () => {
  for(const v of [NaN,Infinity,-Infinity,undefined,()=>{},1n,Symbol('x'),new Date(),new Map(),/x/,new Number(1)]){assert.throws(()=>canonicalJson(v));assert.throws(()=>canonicalJson({nested:[v]}));}
  assert.throws(()=>canonicalJson(new Array(2)));const cyclic={};cyclic.self=cyclic;assert.throws(()=>canonicalJson(cyclic));
  assert.throws(()=>canonicalJson({get x(){throw Error('must not execute');}}),/invalid_canonical_value/);
  assert.equal(canonicalJson(Object.assign(Object.create(null),{x:1})),'{"x":1}');
});
test('hashPayload matches independent hard-coded SHA-256 known answer', async () => {
  assert.equal(await hashPayload('abc'),'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(hashPayload('\ud800'),/invalid_payload/);
});
test('offline size report accepts synthetic backup/state and never prints input on failures', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'scroll-relay-')),file=path.join(dir,'PRIVATE_FILENAME.json'),script=fileURLToPath(new URL('../scripts/relay-size-report.mjs',import.meta.url));
  const run=()=>spawnSync(process.execPath,[script,file],{encoding:'utf8'});
  try{
    const s=advanceFixture(1000), baseline=built(s);
    for(const value of [backup(s),s]){await writeFile(file,JSON.stringify(value));const r=run();assert.equal(r.status,0);assert.equal(r.stderr,'');assert.ok(!/PRIVATE|synthetic-owner|00000000/.test(r.stdout));assert.match(r.stdout,/relay-eligible yes/);assert.match(r.stdout,new RegExp('payload_bytes '+baseline.payload_bytes+'\n'));assert.match(r.stdout,/section characters\[0\]\.profile \d+/);assert.equal(r.stdout.split('\n').filter(l=>l.startsWith('largest ')).length,5);assert.match(r.stdout,new RegExp('what_if_token_tail 16 payload_bytes '+baseline.payload_bytes));
      for(const cap of [0,64]){const copy=JSON.parse(baseline.payload),length=Math.min(cap,1000);copy.last_advance.tokens_tail=Array.from({length},(_,i)=>dayToken(s,1000-length+i+1));copy.last_advance.omitted_count=1000-length;assert.match(r.stdout,new RegExp('what_if_token_tail '+cap+' payload_bytes '+size(canonicalJson(copy))));}}
    for(const [contents,code] of [['PRIVATE_BROKEN_JSON','invalid_json'],[JSON.stringify({PRIVATE_BAD_KEY:'PRIVATE_BAD_VALUE'}),'invalid_state']]){await writeFile(file,contents);const r=run();assert.equal(r.status,1);assert.equal(r.stdout,'error '+code+'\n');assert.equal(r.stderr,'');}
    const missing=spawnSync(process.execPath,[script,file+'PRIVATE_MISSING'],{encoding:'utf8'});assert.equal(missing.stdout,'error unreadable_file\n');assert.equal(missing.stderr,'');
    s.display_name='PRIVATE_LABEL'.repeat(10);await writeFile(file,JSON.stringify(s));const rejected=run();assert.match(rejected.stdout,/relay-eligible no\nreason display_name_limit/);assert.ok(!rejected.stdout.includes('PRIVATE'));
    s.display_name='Synthetic';s.characters[0].profile.notes='PRIVATE_LARGE_TEXT'.repeat(3000);await writeFile(file,JSON.stringify(s));const large=run();assert.match(large.stdout,/payload_status too_large/);assert.match(large.stdout,/headroom -\d+/);assert.ok(!large.stdout.includes('PRIVATE'));
  }finally{await rm(dir,{recursive:true,force:true});}
});

