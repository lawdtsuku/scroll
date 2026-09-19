import {exact,text,integer,validateMember,rosterProgress} from './roster.js';
const list=v=>{if(!Array.isArray(v)||v.length>1000)throw Error('Invalid snapshot list.');};
export function validateSnapshot(p){
 exact(p,['format','version','exported_at','owner_character_id','trainer','roster','inventory']);
 if(p.format!=='scroll-trainer-snapshot'||p.version!==1)throw Error('Choose a Scroll trainer snapshot, not a baseline, update or backup.');
 text(p.exported_at);if(!Number.isFinite(Date.parse(p.exported_at)))throw Error('Invalid snapshot export time.');text(p.owner_character_id);
 const c=p.trainer;exact(c,['character_id','name','level','xp_total','resources','currency','attributes','ability_slots']);
 if(c.character_id!==p.owner_character_id)throw Error('Snapshot owner mismatch.');text(c.name);integer(c.level,1);integer(c.xp_total);
 list(c.resources);for(const r of c.resources){exact(r,['id','label','current','max']);text(r.id);text(r.label);integer(r.current,-Number.MAX_SAFE_INTEGER);integer(r.max);}
 exact(c.currency,['label','amount']);text(c.currency.label);integer(c.currency.amount,-Number.MAX_SAFE_INTEGER);
 list(c.attributes);for(const a of c.attributes){exact(a,['key','label','value','note']);text(a.key);text(a.label);if(typeof a.value==='number')integer(a.value,-Number.MAX_SAFE_INTEGER);else text(a.value,true);text(a.note,true);}
 list(c.ability_slots);for(const slot of c.ability_slots){exact(slot,['index','name','applications']);integer(slot.index,1);if(slot.name!==null)text(slot.name);list(slot.applications);for(const a of slot.applications){exact(a,['name','status','cost','range','effect','notes']);for(const key of Object.keys(a))text(a[key]);if(!['locked','trained_unquantified','in_development','not_recorded'].includes(a.status))throw Error('Invalid ability status.');}}
 list(p.inventory);for(const i of p.inventory){exact(i,['item','qty','consumable','notes']);text(i.item);integer(i.qty);if(typeof i.consumable!=='boolean')throw Error('Invalid inventory item.');text(i.notes,true);}
 list(p.roster);const ids=new Set();for(const entry of p.roster){exact(entry,['member','progress']);validateMember(entry.member,[p.owner_character_id]);if(ids.has(entry.member.roster_id))throw Error('Duplicate roster member.');ids.add(entry.member.roster_id);exact(entry.progress,['next_level_xp','remaining','status']);if(!['known','unknown','undefined'].includes(entry.progress.status))throw Error('Invalid XP progress.');for(const k of ['next_level_xp','remaining'])if(entry.progress[k]!==null)integer(entry.progress[k]);}
 return p;
}
// Explicit projection: never spread a campaign, character, or history into the file.
export function exportSnapshot(s,owner){
 const c=s.characters.find(c=>c.character_id===owner);if(!c)throw Error('Unknown trainer.');
 const p={format:'scroll-trainer-snapshot',version:1,exported_at:new Date().toISOString(),owner_character_id:owner,trainer:{character_id:c.character_id,name:c.name,level:c.level,xp_total:c.xp_total,resources:c.resources.map(r=>({id:r.id,label:s.resources.find(d=>d.id===r.id).label,current:r.current,max:r.max})),currency:{label:s.currency.label,amount:c.currency_amount},attributes:c.attributes.map(a=>({key:a.key,label:a.label,value:a.value,note:a.note||''})),ability_slots:(c.ability_slots||[]).map(slot=>({index:slot.index,name:slot.name,applications:(slot.applications||[]).map(a=>typeof a==='string'?{name:a,status:'not_recorded',cost:'not yet quantified',range:'not yet quantified',effect:'not yet quantified',notes:'Legacy reference; status not recorded in source.'}:{name:a.name,status:a.status,cost:a.cost,range:a.range,effect:a.effect,notes:a.notes})}))},roster:(s.roster||[]).filter(m=>m.owner_character_id===owner).map(m=>({member:structuredClone(m),progress:rosterProgress(m,s.roster_level_thresholds)})),inventory:c.inventory.map(i=>({item:i.item,qty:i.qty,consumable:i.consumable,notes:i.notes||''}))};
 return validateSnapshot(p);
}
export function parseSnapshot(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>5*1024*1024)throw Error('Snapshot must be under 5 MB.');let p;try{p=JSON.parse(raw);}catch{throw Error('Invalid snapshot JSON. Choose the exported JSON file.');}return validateSnapshot(p);}
