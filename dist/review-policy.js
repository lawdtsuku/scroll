// Positive routine allowlist. Unrecognized changes always require individual review.
import {operationIdentity} from './operation-policy.js';
const same=(a,b)=>operationIdentity(a)===operationIdentity(b);
const characterTruth=c=>({...c,currency_amount:0,inventory:[],resources:c.resources.map(r=>({...r,current:0}))});
const memberTruth=m=>({...m,status:null,status_condition:null,held_item:null,resources:m.resources.map(r=>({...r,current:0})),moves:m.moves.map(m=>({...m,pp_current:0}))});
export function isRoutineOperation(o,before){
 if(['adjust_resource','adjust_roster_hp','adjust_move_pp','set_roster_status','adjust_currency','set_currency','adjust_inventory'].includes(o.op))return true;
 if(o.op==='set_roster_field')return o.field==='held_item';
 if(o.op==='set_character'){const c=before?.characters.find(c=>c.character_id===o.character_id);return !!c&&same(characterTruth(c),characterTruth(o.character));}
 if(o.op==='set_roster_member'){const m=before?.roster?.find(m=>m.roster_id===o.member.roster_id&&m.owner_character_id===o.character_id);return !!m&&same(memberTruth(m),memberTruth(o.member));}
 return false;
}
export function individualReviewIndexes(prepared,before){return prepared.next.transactions.at(-1).operations.flatMap((o,i)=>isRoutineOperation(o,before)?[]:[i]);}
