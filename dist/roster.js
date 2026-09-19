// Generic owned roster. No species rules, automatic leveling, rolls or schedules.
const fail=()=>{throw Error('Invalid roster data. Check required fields, owner, numbers and move IDs.');};
export function exact(o,ks){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!ks.includes(k)))fail();}
export function text(v,empty=false){if(typeof v!=='string'||(!empty&&!v.trim())||v.length>5000)fail();}
export function integer(v,min=0){if(!Number.isSafeInteger(v)||v<min)fail();}
function unique(a,key){if(!Array.isArray(a)||a.length>1000||new Set(a.map(x=>x[key])).size!==a.length)fail();}
function detail(v){if(v!==null&&typeof v!=='string'&&typeof v!=='number')fail();if(typeof v==='string')text(v);if(typeof v==='number')integer(v);}
export function validateMember(m,owners){
 exact(m,['roster_id','owner_character_id','status','species','nickname','level','xp_total','resources','stats','moves','ability','bond','held_item','status_condition']);
 text(m.roster_id);text(m.owner_character_id);if(owners&&!owners.includes(m.owner_character_id))fail();if(!['active','boxed'].includes(m.status))fail();text(m.species);text(m.nickname,true);integer(m.level,1);integer(m.xp_total);
 if(!Array.isArray(m.resources)||m.resources.length!==1||m.resources[0].id!=='hp')fail();exact(m.resources[0],['id','current','max']);integer(m.resources[0].current,-Number.MAX_SAFE_INTEGER);integer(m.resources[0].max);
 unique(m.stats,'key');if(m.stats.length!==6)fail();for(const a of m.stats){exact(a,['key','label','value']);text(a.key);text(a.label);integer(a.value);}
 unique(m.moves,'move_id');for(const a of m.moves){exact(a,['move_id','name','type','category','power','accuracy','pp_current','pp_max','effect']);for(const k of ['move_id','name','type','category','effect'])text(a[k]);detail(a.power);detail(a.accuracy);integer(a.pp_current);integer(a.pp_max);}
 text(m.ability);text(m.bond);if(/^[-+]?\d+(?:\.\d+)?$/.test(m.bond.trim()))throw Error('Bond must be a named band, not a numeric score.');if(m.held_item!==null)text(m.held_item);
 if(m.status_condition!==null){exact(m.status_condition,['name','duration_remaining','duration_unit']);text(m.status_condition.name);if(m.status_condition.duration_remaining!==null)integer(m.status_condition.duration_remaining);text(m.status_condition.duration_unit);}
 return m;
}
export function validateRoster(s){
 if(s.roster_config!==undefined){exact(s.roster_config,['label']);text(s.roster_config.label);}
 if(s.roster_level_thresholds!==undefined){exact(s.roster_level_thresholds,Object.keys(s.roster_level_thresholds));for(const [k,v]of Object.entries(s.roster_level_thresholds)){if(!/^[1-9]\d*$/.test(k))fail();if(v!=='unknown')integer(v);}}
 if(s.roster!==undefined){unique(s.roster,'roster_id');for(const m of s.roster)validateMember(m,s.characters.map(c=>c.character_id));}
}
export const ROSTER_OPERATIONS=['configure_roster','add_roster_member','set_roster_member','set_roster_status','adjust_roster_hp','adjust_move_pp','award_roster_xp','set_roster_level_threshold'];
export function applyRoster(s,o){
 if(!ROSTER_OPERATIONS.includes(o.op))return false;
 text(o.character_id);text(o.reason);if(!s.characters.some(c=>c.character_id===o.character_id))fail();
 const base=['op','character_id','reason'];
 if(o.op==='configure_roster'){exact(o,[...base,'label']);text(o.label);s.roster_config={label:o.label};return true;}
 if(o.op==='set_roster_level_threshold'){exact(o,[...base,'level','cumulative_xp']);integer(o.level,1);if(o.cumulative_xp!=='unknown')integer(o.cumulative_xp);s.roster_level_thresholds={...s.roster_level_thresholds,[o.level]:o.cumulative_xp};return true;}
 s.roster??=[];
 if(o.op==='add_roster_member'||o.op==='set_roster_member'){
  exact(o,[...base,'member']);validateMember(o.member,s.characters.map(c=>c.character_id));if(o.member.owner_character_id!==o.character_id)fail();
  const i=s.roster.findIndex(m=>m.roster_id===o.member.roster_id);
  if(o.op==='add_roster_member'){if(i!==-1)throw Error('Roster ID already exists.');s.roster.push(structuredClone(o.member));}
  else{if(i===-1||s.roster[i].owner_character_id!==o.character_id)throw Error('Roster member does not belong to this trainer.');s.roster[i]=structuredClone(o.member);}return true;
 }
 const m=s.roster.find(m=>m.roster_id===o.roster_id&&m.owner_character_id===o.character_id);if(!m)throw Error('Roster member does not belong to this trainer.');
 if(o.op==='set_roster_status'){exact(o,[...base,'roster_id','status']);if(!['active','boxed'].includes(o.status))fail();m.status=o.status;}
 else{exact(o,[...base,'roster_id','delta',...(o.op==='adjust_move_pp'?['move_id']:[])]);integer(o.delta,-Number.MAX_SAFE_INTEGER);if(o.delta===0)throw Error('Delta must be nonzero.');
  if(o.op==='adjust_roster_hp')m.resources[0].current+=o.delta;
  if(o.op==='award_roster_xp')m.xp_total+=o.delta;
  if(o.op==='adjust_move_pp'){const move=m.moves.find(a=>a.move_id===o.move_id);if(!move)throw Error('Unknown move ID.');move.pp_current+=o.delta;}
 }
 validateMember(m);return true;
}
export function rosterProgress(m,table={}){const next=table[String(m.level+1)];return {next_level_xp:typeof next==='number'?next:null,remaining:typeof next==='number'?Math.max(0,next-m.xp_total):null,status:typeof next==='number'?'known':next==='unknown'?'unknown':'undefined'};}
