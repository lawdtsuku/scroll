import {validateRoster,applyRoster} from './roster.js';
import {createScheduler,validateScheduler,applyExtended,advance,safeDisplay,schedulerProjection,dayToken,visibleEvents,thresholdProgress} from './progress.js';
import {assertImportable,operationIdentity} from './operation-policy.js';
export const VERSION = 1;
export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
const fail = message => { throw new Error(message); };
const object = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label} must be an object.`); };
const str = (v, label, empty = false) => { if (typeof v !== 'string' || (!empty && !v.trim()) || v.length > 100000) fail(`${label} must be text${empty ? '' : ' and cannot be blank'}.`); };
const num = (v, label, min = -Number.MAX_SAFE_INTEGER) => { if (!Number.isSafeInteger(v) || v < min) fail(`${label} must be a whole number${min >= 0 ? ` of at least ${min}` : ''}.`); };
const array = (v, label) => { if (!Array.isArray(v) || v.length > 100000) fail(`${label} must be a list.`); };
const unique = (list, key) => { if (new Set(list.map(x => x[key])).size !== list.length) fail(`Duplicate ${key}.`); };
function keys(o, allowed, label) { object(o, label); for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`Unsupported ${label} field: ${k}.`); }
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function validateCharacter(c, campaign) {
  keys(c, ['character_id','campaign_id','name','player_note','level','xp_total','resources','currency_amount','attributes','profile','ability_slots','inventory','reference_revision'], 'character');
  str(c.character_id,'Character ID'); if(c.campaign_id !== campaign.campaign_id) fail('Character belongs to another campaign.');
  str(c.name,'Character name'); if(c.player_note !== undefined) str(c.player_note,'Player note',true);
  num(c.level,'Level',1); num(c.xp_total,'XP',0); num(c.currency_amount,'Currency'); num(c.reference_revision,'Reference revision',0);
  array(c.resources,'Resources'); unique(c.resources,'id');
  for(const r of c.resources) { keys(r,['id','current','max'],'resource'); if(!campaign.resources.some(d=>d.id===r.id)) fail('Unknown resource.'); num(r.current,'Current resource'); num(r.max,'Resource maximum',0); }
  if(c.resources.length !== campaign.resources.length) fail('Every character must have all configured resources.');
  array(c.attributes,'Attributes'); unique(c.attributes,'key');
  for(const a of c.attributes){ keys(a,['key','label','value','note'],'attribute'); str(a.key,'Attribute key'); str(a.label,'Attribute label'); if(typeof a.value==='number') num(a.value,'Attribute'); else str(a.value,'Attribute',true); if(a.note!==undefined) str(a.note,'Attribute note',true); }
  keys(c.profile,['concept','motivation','notes','details'],'profile');
  for(const k of ['concept','motivation','notes']) if(c.profile[k]!==undefined) str(c.profile[k],k,true);
  if(c.profile.details!==undefined){ array(c.profile.details,'Profile details'); for(const d of c.profile.details){ keys(d,['key','value'],'detail'); str(d.key,'Detail key'); str(d.value,'Detail',true); } }
  array(c.inventory,'Inventory'); unique(c.inventory,'item');
  for(const i of c.inventory){ keys(i,['item','qty','consumable','notes'],'inventory item'); str(i.item,'Item'); num(i.qty,'Quantity',0); if(typeof i.consumable!=='boolean') fail('Consumable must be true or false.'); if(i.notes!==undefined) str(i.notes,'Item notes',true); }
  if(c.ability_slots!==undefined){ if(!campaign.ability_slots_enabled) fail('Ability slots are disabled.'); array(c.ability_slots,'Slots'); unique(c.ability_slots,'index'); for(const s of c.ability_slots){ keys(s,['index','name','applications'],'slot'); num(s.index,'Slot index',1); if(s.name!==null) str(s.name,'Slot name'); if(s.applications!==undefined){array(s.applications,'Applications'); s.applications.forEach(a=>{if(typeof a==='string')str(a,'Application');else{keys(a,['name','status','cost','range','effect','notes','threshold_id'],'application');str(a.name,'Application name');if(!['locked','trained_unquantified','in_development'].includes(a.status))fail('Explicit application status required.');for(const k of ['cost','range','effect','notes'])str(a[k],k);if(a.status==='in_development')str(a.threshold_id,'Linked threshold ID');}});} } }
}
export function validateState(s) {
  keys(s,['schema_version','campaign_id','lineage_id','display_name','system_label','current_day','day_label','day_zero_note','resources','currency','level_thresholds','ability_slots_enabled','current_revision','characters','journal','transactions','sessions','recovery','pending_migration','scheduler','thresholds','roster','roster_config','roster_level_thresholds'],'campaign');
  if(s.schema_version!==VERSION) fail('Unsupported schema version.');
  for(const k of ['campaign_id','lineage_id','display_name']) str(s[k],k);
  str(s.system_label,'System label',true); str(s.day_zero_note,'Calendar note',true);
  num(s.current_day,'Current day',0); num(s.current_revision,'Revision',0);
  keys(s.day_label,['singular','plural'],'day labels'); str(s.day_label.singular,'Day label'); str(s.day_label.plural,'Days label');
  keys(s.currency,['id','label'],'currency'); str(s.currency.id,'Currency ID'); str(s.currency.label,'Currency label');
  array(s.resources,'Resource definitions'); unique(s.resources,'id');
  for(const r of s.resources){keys(r,['id','label'],'resource definition'); str(r.id,'Resource ID'); str(r.label,'Resource label');}
  object(s.level_thresholds,'Level thresholds'); for(const [k,v] of Object.entries(s.level_thresholds)){ if(!/^[1-9]\d*$/.test(k)) fail('Level threshold keys must be level numbers.'); if(v!=='unknown') num(v,'Level threshold',0); }
  if(typeof s.ability_slots_enabled!=='boolean') fail('Ability slots setting must be true or false.');
  array(s.characters,'Characters'); if(!s.characters.length) fail('At least one player character is required.'); unique(s.characters,'character_id'); s.characters.forEach(c=>validateCharacter(c,s));
  array(s.sessions,'Sessions'); unique(s.sessions,'session_id'); if(s.sessions.filter(x=>x.state==='open').length>1) fail('Only one session may be open.');
  for(const x of s.sessions){ keys(x,['session_id','campaign_id','opened_at','closed_at','opening_day','closing_day','state','notes','advance_submitted'],'session'); str(x.session_id,'Session ID'); str(x.opened_at,'Session date'); if(x.campaign_id!==s.campaign_id) fail('Session belongs to another campaign.'); num(x.opening_day,'Opening day',0); if(!['open','closed','abandoned'].includes(x.state)) fail('Invalid session state.'); if(x.state==='open'){if(x.closed_at!==null || x.closing_day!==null) fail('Open session cannot have a closing date.');}else{str(x.closed_at,'Closing date'); num(x.closing_day,'Closing day',0);} }
  array(s.transactions,'Transactions'); unique(s.transactions,'transaction_id');
  for(const t of s.transactions){ keys(t,['transaction_id','campaign_id','timestamp','in_world_day','source','reason','base_revision','operations','journal_seqs','update'],'transaction'); if(t.campaign_id!==s.campaign_id) fail('Transaction belongs to another campaign.'); for(const k of ['transaction_id','timestamp','reason'])str(t[k],k); if(!['manual','restore','dm_handoff'].includes(t.source))fail('Unsupported transaction source in M1.'); num(t.base_revision,'Base revision',0); num(t.in_world_day,'Transaction day',0); array(t.operations,'Operations'); t.operations.forEach(o=>{object(o,'Historical operation');str(o.op,'Operation name');}); array(t.journal_seqs,'Journal references');t.journal_seqs.forEach(n=>num(n,'Journal reference',1)); }
  for(const t of s.transactions)if(t.update!==undefined){
    keys(t.update,['update_id','lineage_id','operations_key','receipt','request_operations'],'update record');
    for(const k of ['update_id','lineage_id'])str(t.update[k],k);if(t.update.operations_key!==operationIdentity(t.update.request_operations||t.operations))fail('Update identity does not match its operations.');
    if(t.source!=='dm_handoff')fail('Update receipt must belong to a DM transaction.');
    assertImportable(t.operations);
    const r=t.update.receipt;keys(r,['format','version','campaign_id','lineage_id','update_id','current_revision','current_day','confirmed_changes','pending_changes','day_tokens','event_id_mapping','status','interruption'],'receipt');
    if(r.format!=='scroll-update-receipt'||r.version!==1||r.campaign_id!==s.campaign_id||r.lineage_id!==t.update.lineage_id||r.update_id!==t.update.update_id)fail('Invalid update receipt identity.');
    if(r.current_revision!==t.base_revision+1||r.current_day!==t.in_world_day)fail('Receipt does not match its transaction.');const expected=s.journal.filter(j=>j.transaction_id===t.transaction_id).map(j=>({character_id:j.character_id,field:j.field,from:j.from,to:j.to,reason:j.reason}));if(operationIdentity(expected)!==operationIdentity(r.confirmed_changes))fail('Receipt does not match its journal.');num(r.current_revision,'Receipt revision',1);num(r.current_day,'Receipt day',0);array(r.confirmed_changes,'Receipt changes');str(r.pending_changes,'Pending note');
    for(const d of r.confirmed_changes){keys(d,['character_id','field','from','to','reason'],'receipt change');if(d.character_id!==null&&!s.characters.some(c=>c.character_id===d.character_id))fail('Invalid receipt character.');str(d.field,'Receipt field');str(d.reason,'Receipt reason');if(!Object.hasOwn(d,'from')||!Object.hasOwn(d,'to'))fail('Receipt missing values.');}
  }
  array(s.journal,'Journal');
  for(let i=0;i<s.journal.length;i++){const j=s.journal[i];keys(j,['journal_seq','transaction_id','campaign_id','timestamp','in_world_day','character_id','entity','entity_id','field','from','to','reason','source'],'journal entry'); if(j.journal_seq!==i+1)fail('Journal sequence is broken.'); if(j.campaign_id!==s.campaign_id) fail('Journal belongs to another campaign.'); if(j.character_id!==null && !s.characters.some(c=>c.character_id===j.character_id)) fail('Unknown journal character.'); for(const k of ['transaction_id','timestamp','entity','entity_id','field','reason'])str(j[k],k); num(j.in_world_day,'Journal day',0); if(!Object.hasOwn(j,'from')||!Object.hasOwn(j,'to'))fail('Journal values missing.'); const t=s.transactions.find(t=>t.transaction_id===j.transaction_id); if(!t || !t.journal_seqs.includes(j.journal_seq)||t.source!==j.source)fail('Journal transaction reference is invalid.'); }
  for(const t of s.transactions)for(const seq of t.journal_seqs)if(s.journal[seq-1]?.transaction_id!==t.transaction_id)fail('Transaction journal reference is invalid.');
  array(s.recovery,'Recovery history'); s.recovery.forEach(r=>{keys(r,['restored_at','reason','backup_id','previous_lineage','new_lineage'],'recovery'); Object.values(r).forEach(v=>str(v,'Recovery value'));});
  validateScheduler(s);validateRoster(s);
  if(s.pending_migration!==null) validatePending(s.pending_migration,s);
  return s;
}
function validatePending(p,s){
  keys(p,['status','thresholds','events'],'pending migration'); if(p.status!=='not_active')fail('M1 migration records must remain inactive.'); array(p.thresholds,'Pending thresholds'); unique(p.thresholds,'id');
  for(const t of p.thresholds){keys(t,['id','character_id','label','completed_on_day','stages'],'pending threshold'); str(t.id,'Threshold ID');str(t.label,'Threshold label');if(!s.characters.some(c=>c.character_id===t.character_id))fail('Unknown threshold character.');if(t.completed_on_day!==null&&t.completed_on_day!=='unknown')num(t.completed_on_day,'Completion day',0);array(t.stages,'Stages');for(const stage of t.stages){keys(stage,['stage_index','required','baseline','consecutive_required','dc_revisions','attempts'],'pending stage');num(stage.stage_index,'Stage index',0);num(stage.required,'Required successes',1);if(typeof stage.consecutive_required!=='boolean')fail('Invalid consecutive rule.');keys(stage.baseline,['successes','streak','note'],'baseline');for(const k of ['successes','streak'])if(stage.baseline[k]!=='unknown')num(stage.baseline[k],k,0);str(stage.baseline.note,'Baseline note',true);array(stage.attempts,'Attempts');if(stage.attempts.length)fail('M1 cannot import historical rolls or attempts.');array(stage.dc_revisions,'DC revisions');for(const d of stage.dc_revisions){keys(d,['revision_id','dc','set_on_day'],'DC revision');str(d.revision_id,'DC revision ID');num(d.dc,'DC');if(d.set_on_day!=='unknown')num(d.set_on_day,'DC date',0);} }}
  array(p.events,'Pending events');unique(p.events,'id');for(const e of p.events){keys(e,['id','visibility','eligible_from_day','must_fire_by_day','selection_rule','fires_on_day','depends_on_id'],'pending event');str(e.id,'Event ID');if(e.visibility!=='dm_only')fail('This pending packet only accepts opaque events.');for(const k of ['eligible_from_day','must_fire_by_day'])if(e[k]!==null)num(e[k],'Event date',0);if(!['unknown','first_day','last_day','random',null].includes(e.selection_rule))fail('Invalid selection rule.');if(e.fires_on_day!==null&&e.fires_on_day!=='PENDING')num(e.fires_on_day,'Firing date',0);if(e.depends_on_id!==undefined)str(e.depends_on_id,'Dependency ID');}
}
export function blankCharacter(campaign, name='New character'){
 return {character_id:uid(),campaign_id:campaign.campaign_id,name,level:1,xp_total:0,resources:campaign.resources.map(r=>({id:r.id,current:0,max:0})),currency_amount:0,attributes:[],profile:{concept:'',motivation:'',notes:'',details:[]},inventory:[],reference_revision:0,...(campaign.ability_slots_enabled?{ability_slots:[]}: {})};
}
export function newCampaign(config){
 const s={schema_version:1,campaign_id:uid(),lineage_id:uid(),display_name:config.display_name,system_label:config.system_label||'',current_day:config.current_day??1,day_label:config.day_label||{singular:'day',plural:'days'},day_zero_note:config.day_zero_note||'',resources:config.resources||[],currency:config.currency||{id:'currency',label:'Currency'},level_thresholds:config.level_thresholds||{},ability_slots_enabled:config.ability_slots_enabled??false,current_revision:0,characters:[],journal:[],transactions:[],sessions:[],recovery:[],pending_migration:null,scheduler:createScheduler(),thresholds:[]};
 s.characters=[blankCharacter(s,config.character_name||'New character')];return validateState(s);
}
const gameFields=['current_day','characters','sessions','level_thresholds','thresholds','roster','roster_config','roster_level_thresholds'];
function changes(before,after,path=''){
 if(same(before,after))return [];
 if(before && after && typeof before==='object' && typeof after==='object' && !Array.isArray(before)&&!Array.isArray(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>changes(before[k],after[k],path?`${path}.${k}`:k));
 return [{field:path,from:clone(before??null),to:clone(after??null)}];
}
export function preview(state, operations, reason, source='manual'){
 validateState(state);str(reason,'Reason');array(operations,'Operations');if(!operations.length)fail('No changes to review.');if(!['manual','restore','dm_handoff'].includes(source))fail('Unsupported update source.');if(source==='dm_handoff')assertImportable(operations);
 const next=clone(state), diffs=[];
 for(const supplied of operations){object(supplied,'Operation');const o={...supplied};if(o.effective_day!==undefined){num(o.effective_day,'Effective day',0);delete o.effective_day;} object(o,'Operation'); const before=clone(next); let c;
   if(applyRoster(next,o)||applyExtended(next,o)){}else if(['set_resource_max','set_level','set_attribute'].includes(o.op)){
    str(o.character_id,'Character ID');str(o.reason,'Operation reason');c=next.characters.find(x=>x.character_id===o.character_id);if(!c)fail('Unknown character.');
    if(o.op==='set_resource_max'){keys(o,['op','character_id','resource','value','reason'],'operation');num(o.value,'Resource maximum',0);const r=c.resources.find(r=>r.id===o.resource);if(!r)fail('Unknown resource for this character.');r.max=o.value;}
    if(o.op==='set_level'){keys(o,['op','character_id','value','reason'],'operation');num(o.value,'Level',1);c.level=o.value;}
    if(o.op==='set_attribute'){keys(o,['op','character_id','key','value','note','reason'],'operation');str(o.key,'Attribute key');const a=c.attributes.find(a=>a.key===o.key);if(!a)fail('Unknown attribute key. Add a new attribute through the character reference editor first.');if(typeof o.value==='number')num(o.value,'Attribute value');else str(o.value,'Attribute value',true);str(o.note,'Attribute note',true);const old=clone(a);a.value=o.value;if(o.note!==undefined)a.note=o.note;if(!same(old,a))c.reference_revision++;}
   }else if(['adjust_resource','award_xp','adjust_currency','adjust_inventory'].includes(o.op)){
    str(o.character_id,'Character ID');c=next.characters.find(x=>x.character_id===o.character_id);if(!c)fail('Unknown character.');num(o.delta,'Delta');str(o.reason,'Operation reason');
    if(o.op==='adjust_resource'){keys(o,['op','character_id','resource','delta','reason'],'operation');const r=c.resources.find(r=>r.id===o.resource);if(!r)fail('Unknown resource for this character.');r.current+=o.delta;}
    if(o.op==='award_xp'){keys(o,['op','character_id','delta','reason'],'operation');c.xp_total+=o.delta;}
    if(o.op==='adjust_currency'){keys(o,['op','character_id','delta','reason'],'operation');c.currency_amount+=o.delta;}
    if(o.op==='adjust_inventory'){keys(o,['op','character_id','item','delta','consumable','notes','reason'],'operation');str(o.item,'Item name');const item=c.inventory.find(i=>i.item===o.item);if(item){if(o.consumable!==undefined&&o.consumable!==item.consumable)fail('Inventory deltas cannot change an existing item’s type.');if(o.notes!==undefined&&o.notes!==(item.notes||''))fail('Inventory deltas cannot replace an existing item’s notes.');item.qty+=o.delta;}else{if(o.delta<=0)fail('Cannot remove an item that is not recorded.');if(typeof o.consumable!=='boolean')fail('New items require an explicit consumable flag.');c.inventory.push({item:o.item,qty:o.delta,consumable:o.consumable,...(o.notes!==undefined?{notes:o.notes}:{})});}}
   }else if(['set_character','add_character'].includes(o.op)){
    if(o.op==='set_character'){keys(o,['op','character_id','character'],'operation');str(o.character_id,'Character ID');c=next.characters.find(x=>x.character_id===o.character_id);if(!c)fail('Unknown character.');if(o.character.character_id!==c.character_id||o.character.campaign_id!==next.campaign_id)fail('Character identity cannot be changed.');const copy=clone(o.character);copy.reference_revision=c.reference_revision; if(!same([c.name,c.attributes,c.profile,c.ability_slots,c.player_note],[copy.name,copy.attributes,copy.profile,copy.ability_slots,copy.player_note]))copy.reference_revision++;validateCharacter(copy,next);next.characters[next.characters.indexOf(c)]=copy;
    } else {keys(o,['op','character_id','character'],'operation');if(o.character_id!==o.character.character_id)fail('Character ID required.');if(next.characters.some(c=>c.character_id===o.character_id))fail('Character already exists.');validateCharacter(o.character,next);next.characters.push(clone(o.character));}
   }else if(o.op==='advance_day'||o.op==='correct_day'){
    keys(o,['op','to_day','reason','skip_through'],'operation');if(o.skip_through!==undefined&&typeof o.skip_through!=='boolean')fail('skip_through must be boolean.');num(o.to_day,'Day',0);if(o.op==='advance_day'&&o.to_day<=next.current_day)fail('Choose a later day. Use calendar correction to move backward.');if(o.op==='advance_day')advance(next,o);else next.current_day=o.to_day;
   }else if(o.op==='open_session'){
    keys(o,['op'],'operation');if(next.sessions.some(s=>s.state==='open'))fail('A session is already open.');next.sessions.push({session_id:uid(),campaign_id:next.campaign_id,opened_at:now(),closed_at:null,opening_day:next.current_day,closing_day:null,state:'open',notes:'',advance_submitted:false});
   }else if(o.op==='close_session'||o.op==='abandon_session'){
    keys(o,['op'],'operation');const session=next.sessions.find(s=>s.state==='open');if(!session)fail('No open session.');session.closed_at=now();session.closing_day=next.current_day;session.state=o.op==='close_session'?'closed':'abandoned';
   }else fail(`Unsupported operation: ${o.op}.`);
   if(!same(before.scheduler,next.scheduler))diffs.push({character_id:null,entity:'campaign',entity_id:next.campaign_id,field:'scheduler',from:schedulerProjection(before),to:{...schedulerProjection(next),change:o.op},reason:['schedule_event','amend_event_date','configure_migrated_events'].includes(o.op)?'imported':o.reason||reason});
   if(c)validateCharacter(next.characters.find(x=>x.character_id===c.character_id),next);
   for(const field of gameFields){
    if(field==='roster'){
      for(const member of next.roster||[]){const old=before.roster?.find(m=>m.roster_id===member.roster_id);const deltas=[];
       if(!old)deltas.push({field:'member_created',from:null,to:clone(member)});
       else{for(const key of Object.keys(member)){if(key==='resources'){for(const part of ['current','max'])if(old.resources[0][part]!==member.resources[0][part])deltas.push({field:part+' HP',from:old.resources[0][part],to:member.resources[0][part]});}
        else if(key==='moves'){for(const move of member.moves){const previous=old.moves.find(m=>m.move_id===move.move_id);for(const d of changes(previous,move))deltas.push({...d,field:'move '+move.name+' '+(d.field||'added')});}for(const removed of old.moves.filter(m=>!member.moves.some(n=>n.move_id===m.move_id)))deltas.push({field:'move removed',from:removed,to:null});}
        else for(const d of changes(old[key],member[key],key))deltas.push(d);}}
       for(const d of deltas)diffs.push({...d,field:'roster '+(member.nickname||member.species)+' · '+d.field,character_id:member.owner_character_id,entity:'roster',entity_id:member.roster_id,reason:o.reason||reason});
      }
    }else if(field==='characters'){

      for(const char of next.characters){const old=before.characters.find(x=>x.character_id===char.character_id);for(const d of changes(old,char))diffs.push({...d,field:d.field||'character_created',character_id:char.character_id,entity:'character',entity_id:char.character_id,reason:o.reason||reason});}
    }else for(const d of changes(before[field],next[field],field))diffs.push({...d,character_id:null,entity:'campaign',entity_id:next.campaign_id,reason:o.reason||reason});
   }
 }
 if(!diffs.length)fail('Nothing changed.');
 return finalize(state,next,operations,reason,source,diffs);
}
function finalize(state,next,operations,reason,source,diffs){
 const t={transaction_id:uid(),campaign_id:next.campaign_id,timestamp:now(),in_world_day:next.current_day,source,reason,base_revision:state.current_revision,operations:clone(operations),journal_seqs:[]};
 for(const d of diffs){ const entry={journal_seq:next.journal.length+1,transaction_id:t.transaction_id,campaign_id:next.campaign_id,timestamp:t.timestamp,in_world_day:next.current_day,...clone(d),reason:d.reason||reason,source};next.journal.push(entry);t.journal_seqs.push(entry.journal_seq); }
 next.transactions.push(t);next.current_revision++;validateState(next);
 return {campaign_id:state.campaign_id,base_revision:state.current_revision,lineage_id:state.lineage_id,next,diffs,reason};
}
export function prepareCreation(state,reason){state=clone(state);if(!state.scheduler){state.scheduler=createScheduler();state.thresholds=clone(state.pending_migration?.thresholds||[]);}validateState(state);str(reason,'Reason');if(state.current_revision!==0||state.journal.length||state.transactions.length)fail('Not a new baseline.');return finalize(state,clone(state),[{op:'establish_baseline'}],reason,'restore',[{character_id:null,entity:'campaign',entity_id:state.campaign_id,field:'opening_baseline',from:null,to:clone(state)}]);}
export function backup(state){validateState(state);return {format:'scroll-backup',version:4,campaign_id:state.campaign_id,backup_id:uid(),exported_at:now(),state:clone(state)};}
export function parseBackup(text){
 if(text.length>20*1024*1024)fail('Backup exceeds the 20 MB import limit.');const b=JSON.parse(text);keys(b,['format','version','campaign_id','backup_id','exported_at','state'],'backup');if(b.format!=='scroll-backup'||![1,2,3,4].includes(b.version))fail('Choose a supported Scroll backup, not a session update or migration document.');str(b.backup_id,'Backup ID');str(b.exported_at,'Export date');validateState(b.state);if(b.version===1&&b.state.transactions.some(t=>t.update))fail('Version 1 backups cannot contain import receipts.');if(b.campaign_id!==b.state.campaign_id)fail('Backup campaign identity does not match.');return b;
}
export function prepareRestore(b,current,reason){
 parseBackup(JSON.stringify(b));str(reason,'Restore reason');if(current&&current.campaign_id!==b.campaign_id)fail('Restore target mismatch.');const next=clone(b.state);const previous=next.lineage_id;next.lineage_id=uid();next.recovery.push({restored_at:now(),reason,backup_id:b.backup_id,previous_lineage:previous,new_lineage:next.lineage_id});
 const p=finalize(b.state,next,[{op:'restore_backup',backup_id:b.backup_id}],reason,'restore',[{character_id:null,entity:'campaign',entity_id:next.campaign_id,field:'lineage_id',from:previous,to:next.lineage_id}]);
 return {...p,base_revision:current?.current_revision??null,lineage_id:current?.lineage_id??null,diffs:[{character_id:null,entity:'campaign',entity_id:next.campaign_id,field:'Restore complete campaign',from:current?`${current.display_name}, day ${current.current_day}, ${current.journal.length} journal entries`:'No saved campaign',to:`${next.display_name}, day ${next.current_day}, ${b.state.journal.length} imported journal entries; new lineage`}]};
}
export function summary(s){const lastAdvance=s.transactions.findLast(t=>t.operations.some(o=>o.op==='advance_day'));const span=lastAdvance?s.journal.find(j=>j.transaction_id===lastAdvance.transaction_id&&j.field==='current_day'):null;const tokens=span&&s.scheduler?Array.from({length:Math.max(0,span.to-span.from)},(_,i)=>dayToken(s,span.from+i+1)):[];return JSON.stringify({format:'scroll-state-summary',version:1,campaign_id:s.campaign_id,lineage_id:s.lineage_id,current_revision:s.current_revision,current_day:s.current_day,day_token:dayToken(s),last_advance_tokens:tokens,day_label:s.day_label.singular,scope:'Confirmed saved state. Retain all unsubmitted DM changes. Rolls are external. Only day advance triggers scheduled events.',event_resolution_reminder:'Resolve scheduled events in your primary campaign conversation, not a side conversation.',unresolved_events:visibleEvents(s),pending_remainder:s.scheduler?.remainder||null,characters:s.characters.map(c=>({character_id:c.character_id,name:c.name,level:c.level,xp_total:c.xp_total,resources:c.resources,currency:{label:s.currency.label,amount:c.currency_amount},inventory:c.inventory,inventory_complete:true})),roster:s.roster||[],roster_config:s.roster_config||{label:'Roster'},roster_level_thresholds:s.roster_level_thresholds||{},level_thresholds:s.level_thresholds,thresholds:s.thresholds||[],session:s.sessions.find(x=>x.state==='open')||null,pending_migration:s.pending_migration?'Migration configuration still needs review.':null},null,2);}
