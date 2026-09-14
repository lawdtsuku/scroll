// Positive allowlist. New operation names fail closed for every transport.
export const AUTOMATABLE_OPERATIONS = Object.freeze(['set_xp','set_currency','set_level_threshold','log_threshold_attempt','set_ability_detail','adjust_resource','set_resource_max','set_level','set_attribute','award_xp','adjust_currency','adjust_inventory','advance_day']);
export const HUMAN_ONLY_OPERATIONS = Object.freeze(['set_dc','amend_dc','set_threshold_dc','record_roll','append_roll','correct_roll','write_roll_log','amend_event_date','resolve_event','edit_journal','edit_audit_journal']);
export function assertAutomatable(operations) {
  if(!Array.isArray(operations))throw new Error('Operations must be a list.');
  for(const operation of operations) {
    if(!AUTOMATABLE_OPERATIONS.includes(operation?.op)) {
      const error=new Error(HUMAN_ONLY_OPERATIONS.includes(operation?.op)
        ? 'This update contains a protected operation. It requires a dedicated human-confirmed control and cannot be applied by an import or automatic transport.'
        : 'This update contains an unsupported operation. Nothing was applied.');
      error.code=HUMAN_ONLY_OPERATIONS.includes(operation?.op)?'HUMAN_CONFIRMATION_REQUIRED':'UNSUPPORTED_OPERATION';
      throw error;
    }
  }
}
// Review authorization is process-local, one-use and bound to the exact preview.
// A JSON field such as confirmed:true or source:"manual" is never authorization.
const reviews=new WeakMap();
export function authorizeUpdateReview(prepared,event) {
  if(!(event instanceof Event)||!event.isTrusted||event.type!=='click'||!(event.currentTarget instanceof HTMLButtonElement)||event.currentTarget.id!=='confirm-save'||!event.currentTarget.isConnected)throw new Error('Confirm the visible review with a click or tap.');
  if(prepared.importEnvelope)assertImportable(prepared.importEnvelope.operations);
  if(protectedOperations(prepared.next.transactions.at(-1).operations).length&&!event.currentTarget.ownerDocument.querySelector('#protected-confirm')?.checked)throw Error('Explicit protected-operation approval is required.');
  reviews.set(prepared,{snapshot:JSON.stringify(prepared),protectedApproved:!!event.currentTarget.ownerDocument.querySelector('#protected-confirm')?.checked});
}
export function consumeUpdateReview(prepared) {
  const reviewed=reviews.get(prepared);reviews.delete(prepared);
  if(!reviewed||reviewed.snapshot!==JSON.stringify(prepared))throw new Error('This update needs a new human review. Nothing was saved.');
  if(prepared.importEnvelope)assertImportable(prepared.importEnvelope.operations);
  return reviewed.protectedApproved;
}

export function operationIdentity(value){if(Array.isArray(value))return '['+value.map(operationIdentity).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+operationIdentity(value[k])).join(',')+'}';return JSON.stringify(value);}

export const REVIEW_ONLY_OPERATIONS=Object.freeze(['schedule_event','amend_event_date','resolve_event','set_threshold_dc','configure_migrated_events','activate_scheduler']);
export function assertImportable(operations){if(!Array.isArray(operations))throw Error('Operations must be a list.');for(const o of operations)if(!REVIEW_ONLY_OPERATIONS.includes(o?.op))assertAutomatable([o]);}
export function protectedOperations(operations){return operations.filter(o=>o.op==='restore_backup'||REVIEW_ONLY_OPERATIONS.includes(o.op)||o.op==='advance_day'&&o.skip_through);}

// Compare stored protected facts as well as the declared vocabulary.
export function hasProtectedMutation(before,after){if(!before)return false;const same=(a,b)=>operationIdentity(a)===operationIdentity(b);if(!same(before.journal,after.journal.slice(0,before.journal.length)))return true;const schedules=s=>(s.scheduler?.events||[]).map(e=>({id:e.id,visibility:e.visibility,label:e.label,eligible_from_day:e.eligible_from_day,must_fire_by_day:e.must_fire_by_day,selection_rule:e.selection_rule,fires_on_day:e.fires_on_day,resolved_at:e.resolved_at,revisions:e.revisions}));if(!same(schedules(before),schedules(after)))return true;const dcs=s=>(s.thresholds||[]).map(t=>({id:t.id,character_id:t.character_id,stages:t.stages.map(g=>g.dc_revisions)}));return !same(dcs(before),dcs(after));}
