import {applyExtended,dayToken,safeDisplay,planAdvance} from './progress.js';
import {preview,validateState,summary,clone} from './core.js';
import {assertImportable,operationIdentity} from './operation-policy.js';
const fail=(message,code='INVALID_UPDATE')=>{const e=new Error(message);e.code=code;throw e;};
function fields(o,allowed){if(!o||typeof o!=='object'||Array.isArray(o))fail('Expected a JSON object.');if(Object.keys(o).some(k=>!allowed.includes(k)))fail('Unexpected field in update. Use the documented update format.');}
const integer=(n,label,min=-Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(n)||n<min)fail(`${label} must be a whole number${min>=0?' of at least '+min:''}.`);};
const text=(s,label)=>{if(typeof s!=='string'||!s.trim()||s.length>5000)fail(`${label} must be nonempty text (maximum 5,000 characters).`);};
// Semantic comparison of parsed JSON, including ordered operations. Not a hash
// or the future roll-chain canonicalizer; never used as integrity evidence.
export const operationsKey=operationIdentity;
export function parseUpdate(input) {
 if(typeof input!=='string'||new TextEncoder().encode(input).length>1024*1024)fail('Update must be text under 1 MB.');
 let raw=input.trim();
 if(raw.startsWith('```')){const match=/^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(raw);if(!match)fail('Paste one complete JSON block, without surrounding narration.');raw=match[1];}
 let u;try{u=JSON.parse(raw);}catch{fail('Invalid JSON. Paste one complete update block or choose its JSON file.');}
 return validateUpdate(u);
}
export function validateUpdate(u){
 fields(u,['format','version','campaign_id','lineage_id','update_id','base_revision','operations']);
 if(u.format!=='scroll-session-update'||u.version!==1)fail('Expected scroll-session-update version 1. Backups use the separate restore path.');
 for(const k of ['campaign_id','lineage_id','update_id'])text(u[k],k);integer(u.base_revision,'base_revision',0);
 if(!Array.isArray(u.operations)||!u.operations.length||u.operations.length>200)fail('An update needs 1–200 operations.');
 assertImportable(u.operations);
 for(const o of u.operations){if(o.effective_day!==undefined)integer(o.effective_day,'effective_day',0);
  if(['set_xp','set_currency','set_level_threshold','log_threshold_attempt','set_ability_detail','set_threshold_dc','schedule_event','amend_event_date','resolve_event','configure_migrated_events','activate_scheduler'].includes(o.op)){text(o.reason,'Operation reason');if(o.op!=='activate_scheduler')text(o.character_id,'character_id');continue;}
  const allowed={adjust_resource:['resource','delta'],set_resource_max:['resource','value'],set_level:['value'],set_attribute:['key','value','note'],award_xp:['delta'],adjust_currency:['delta'],adjust_inventory:['item','delta','consumable','notes'],advance_day:['to_day','skip_through']}[o.op];
  fields(o,['op','reason','effective_day',...(o.op==='advance_day'?[]:['character_id']),...allowed]);text(o.reason,'Operation reason');
  if(o.op==='advance_day')integer(o.to_day,'to_day',0);
  else {
   text(o.character_id,'character_id');
   if(o.op==='set_resource_max')integer(o.value,'Maximum value',0);
   else if(o.op==='set_level')integer(o.value,'Level value',1);
   else if(o.op==='set_attribute'){
    text(o.key,'Attribute key');
    if(typeof o.value==='number')integer(o.value,'Attribute value');
    else if(typeof o.value!=='string'||o.value.length>5000)fail('Attribute value must be a whole number or text under 5,000 characters.');
    if(typeof o.note!=='string'||o.note.length>5000)fail('Attribute note must be text under 5,000 characters.');
   }else{integer(o.delta,'delta');if(o.delta===0)fail('A delta must be nonzero.');}
  }
  if(['adjust_resource','set_resource_max'].includes(o.op))text(o.resource,'Resource ID');
  if(o.op==='adjust_inventory'){text(o.item,'Item name');if(o.consumable!==undefined&&typeof o.consumable!=='boolean')fail('consumable must be true or false.');if(o.notes!==undefined&&(typeof o.notes!=='string'||o.notes.length>5000))fail('Item notes must be text under 5,000 characters.');}
 }
 return clone(u);
}
export function previewUpdate(state,input){
 const u=typeof input==='string'?parseUpdate(input):validateUpdate(input);validateState(state);
 if(u.campaign_id!==state.campaign_id)fail('This update belongs to another campaign. Switch campaigns to review it.','WRONG_CAMPAIGN');
 if(u.lineage_id!==state.lineage_id){const e=new Error('This update is from another campaign timeline. Send the refresh block to the DM; do not edit IDs by hand.');e.code='WRONG_LINEAGE';e.refresh=summary(state);throw e;}
 const key=operationsKey(u.operations),prior=state.transactions.find(t=>t.update?.update_id===u.update_id);
 if(prior){if(prior.update.operations_key!==key)fail('This update ID was already used with different operations. Ask the DM for a new update ID.','UPDATE_ID_CONFLICT');return {status:'already_applied',receipt:clone(prior.update.receipt),refresh:summary(state)};}
 if(u.base_revision!==state.current_revision){const e=new Error('The DM used an older saved state. Send this refresh block back and request only the remaining pending changes.');e.code='STALE_REVISION';e.refresh=summary(state);throw e;}
 const advances=u.operations.filter(o=>o.op==='advance_day');if(advances.length>1)fail('Use one day advance per update so travel effects can be scoped safely.');if(advances.length&&u.operations.some(o=>['schedule_event','amend_event_date','configure_migrated_events','activate_scheduler'].includes(o.op)))fail('Submit schedule changes separately from time advances.');
 const travel=advances[0],reached=travel?planAdvance(state,travel):state.current_day;
 const interrupted=!!travel&&reached<travel.to_day;
 // If any effect belongs beyond the stop (or is unscoped), hold ALL non-time effects for DM revision.
 const held=interrupted&&u.operations.some(o=>o.op!=='advance_day'&&(o.effective_day===undefined||o.effective_day>reached));
 if(!interrupted&&u.operations.some(o=>o.effective_day!==undefined&&o.effective_day>reached))fail('Operation effective_day is beyond this update’s destination.');
 const applied=held?[travel]:u.operations;
 // Validate every requested operation before committing even a time-only portion.
 if(held){const validationState=clone(state);validationState.scheduler.cover='0'.repeat(validationState.scheduler.cover.length);preview(validationState,u.operations.map(o=>o.op==='advance_day'?{...o,skip_through:true}:o),'Validate requested operations','dm_handoff');}
 const p=preview(state,applied,`DM update ${u.update_id}`,'dm_handoff');
 const day_tokens=[];let tokenDay=state.current_day;for(const o of u.operations)if(o.op==='advance_day'){for(let d=tokenDay+1;d<=p.next.current_day;d++)day_tokens.push(dayToken(p.next,d));tokenDay=o.to_day;}
 const receipt={format:'scroll-update-receipt',version:1,campaign_id:state.campaign_id,lineage_id:state.lineage_id,update_id:u.update_id,current_revision:p.next.current_revision,current_day:p.next.current_day,status:held?'interrupted':'applied',interruption:held?{day_reached:p.next.current_day,token:dayToken(p.next),instruction:'Time committed only. All other operations remain pending. Send a new update scoped to the day reached; resume remaining travel separately.'}:null,day_tokens,event_id_mapping:(p.next.scheduler?.events||[]).filter(e=>e.alias).map(e=>({previous_id:e.alias,id:e.id})),confirmed_changes:p.diffs.map(d=>({character_id:d.character_id,field:d.field,from:d.from,to:d.to,reason:d.reason})),pending_changes:held?'Only elapsed time is confirmed. All non-time operations were rejected for this portion and remain pending with the DM.':'Only these changes are confirmed. Keep all other unsubmitted changes pending.'};
 p.next.transactions.at(-1).update={update_id:u.update_id,lineage_id:u.lineage_id,operations_key:key,receipt,request_operations:clone(u.operations)};
 p.importEnvelope=u;p.receipt=receipt;validateState(p.next);return p;
}
export function updateTemplate(state){return {format:'scroll-session-update',version:1,campaign_id:state.campaign_id,lineage_id:state.lineage_id,update_id:'REPLACE-WITH-NEW-UNIQUE-ID',base_revision:state.current_revision,operations:[]};}
export function clipboardCandidate(text,state){try{const u=parseUpdate(text);if(u.campaign_id!==state.campaign_id||u.lineage_id!==state.lineage_id)return null;const p=previewUpdate(state,u);return p.status==='already_applied'?null:u;}catch{return null;}}

// The guard keeps its machine-readable refresh; the UI copies one complete DM handoff.
export function refreshHandoff(refresh){return 'This is my current Scroll state — please regenerate the pending update using this lineage_id and current_revision as base_revision. Include only changes that are still pending, use a new update_id, and return a complete Scroll update for me to review. Resolve scheduled events in our primary campaign conversation.\n\n'+refresh;}
