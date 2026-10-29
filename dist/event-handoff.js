// DM handoffs only. Never normalize or rewrite stored legacy aliases.
export function outboundAlias(value){
 if(typeof value!=='string')return undefined;
 const match=/^(?:EV-[A-Z0-9-]{1,32}|[0-9a-f-]{6,36})$/.exec(value);
 // Require the full string: JavaScript $ alone also matches before a final newline.
 return match?.[0]===value?value:undefined;
}
const binding=e=>({id:e.id,...(outboundAlias(e.alias)!==undefined?{alias:e.alias}:{})});
export const dmUnresolvedEvents=s=>(s.scheduler?.events||[]).filter(e=>e.state==='triggered').map(e=>({...binding(e),state:e.state}));
export const dmSchedulerProjection=s=>({active:!!s.scheduler,unresolved:dmUnresolvedEvents(s)});
export function receiptEventMapping(before,after){
 const previouslyResolved=new Set((before.scheduler?.events||[]).filter(e=>e.state==='resolved').map(e=>e.id));
 return (after.scheduler?.events||[]).filter(e=>outboundAlias(e.alias)!==undefined&&(e.state==='triggered'||e.state==='resolved'&&!previouslyResolved.has(e.id))).map(e=>({previous_id:e.alias,id:e.id}));
}
// Outbound view of historical receipts as well: storage/history stay untouched.
export function fullReceiptHandoff(receipt){
 const r=structuredClone(receipt);
 if(Array.isArray(r.event_id_mapping))r.event_id_mapping=r.event_id_mapping.filter(e=>e&&outboundAlias(e.previous_id)!==undefined);
 for(const d of r.confirmed_changes||[]){
  if(d?.field!=='scheduler')continue;
  for(const side of [d.from,d.to])if(Array.isArray(side?.unresolved))for(const e of side.unresolved){
   if(e&&typeof e==='object'&&outboundAlias(e.alias)===undefined)delete e.alias;
  }
 }
 return r;
}
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function unresolved(side){
 if(!plain(side)||!Array.isArray(side.unresolved))throw Error('invalid_scheduler_diff');
 const seen=new Set();
 for(const e of side.unresolved){
  if(!plain(e)||typeof e.id!=='string'||!e.id||e.state!=='triggered'||seen.has(e.id))throw Error('invalid_scheduler_diff');
  seen.add(e.id);
 }
 return side.unresolved;
}
// Interpret every scheduler diff, including entries beyond the compact change cap.
// Any uninterpretable diff invalidates the ENTIRE binding list, never just a subset.
export function newlyTriggeredBindings(receipt){
 const result=new Map();
 for(const d of receipt.confirmed_changes||[]){
  if(d?.field!=='scheduler')continue;
  const old=new Set(unresolved(d.from).map(e=>e.id));
  for(const e of unresolved(d.to)){
   if(old.has(e.id))continue;
   const b=binding(e),prior=result.get(e.id);
   if(prior&&JSON.stringify(prior)!==JSON.stringify(b))throw Error('invalid_scheduler_diff');
   result.set(e.id,b);
  }
 }
 return [...result.values()];
}
