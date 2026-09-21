import {validateAttributes} from './attributes.js';
// Generic owned roster. No species rules, automatic leveling, rolls or schedules.
const fail=(path,message)=>{const e=Error(`${path}: ${message}`);e.field_path=path;throw e;};
export function exact(o,ks,path='value'){if(!o||typeof o!=='object'||Array.isArray(o))fail(path,'must be an object.');if(Object.keys(o).some(k=>!ks.includes(k)))fail(path,'has an unexpected field.');}
export function text(v,empty=false,path='value'){if(v===undefined)fail(path,'is required.');if(typeof v!=='string'||(!empty&&!v.trim())||v.length>5000)fail(path,empty?'must be text (maximum 5000 characters).':'must be nonempty text (maximum 5000 characters).');}
export function integer(v,min=0,path='value'){if(!Number.isSafeInteger(v)||v<min)fail(path,`must be a safe whole number of at least ${min}.`);}
function unique(a,key,path){if(!Array.isArray(a)||a.length>1000)fail(path,'must be a list of at most 1000 entries.');const seen=new Set();for(const [i,v]of a.entries()){if(!v||typeof v!=='object'||Array.isArray(v))fail(`${path}[${i}]`,'must be an object.');if(seen.has(v[key]))fail(path,'contains a duplicate ID/key.');seen.add(v[key]);}}
function detail(v,path){if(v===null)return;if(typeof v==='string')text(v,false,path);else integer(v,0,path);}
function scalar(field,value,path=field){if(field==='held_item'&&value===null)return;text(value,field==='nickname',path);if(field==='bond'&&/^[-+]?\d+(?:\.\d+)?$/.test(value.trim()))fail(path,'must be a named band, not a numeric score.');}
export function validateMove(a,path='move'){
 exact(a,['move_id','name','type','category','power','accuracy','pp_current','pp_max','effect'],path);
 for(const k of ['move_id','name','type','category','effect'])text(a[k],false,path+'.'+k);
 for(const k of ['power','accuracy'])detail(a[k],path+'.'+k);
 for(const k of ['pp_current','pp_max'])integer(a[k],0,path+'.'+k);
 return a;
}
export function validateMember(m,owners,{legacy=false}={}){
 exact(m,['roster_id','owner_character_id','status','species','nickname','level','xp_total','resources','stats','moves','ability','bond','held_item','status_condition','attributes'],'member');
 text(m.roster_id,false,'member.roster_id');text(m.owner_character_id,false,'member.owner_character_id');
 if(owners&&!owners.includes(m.owner_character_id))fail('member.owner_character_id','must identify an existing owner.');
 if(!['active','boxed'].includes(m.status))fail('member.status','must be active or boxed.');
 for(const k of ROSTER_SCALAR_FIELDS)scalar(k,m[k],'member.'+k);
 integer(m.level,1,'member.level');integer(m.xp_total,0,'member.xp_total');
 if(!Array.isArray(m.resources)||m.resources.length!==1)fail('member.resources','must contain exactly one HP resource.');
 exact(m.resources[0],['id','current','max'],'member.resources[0]');if(m.resources[0].id!=='hp')fail('member.resources[0].id','must be hp.');
 integer(m.resources[0].current,-Number.MAX_SAFE_INTEGER,'member.resources[0].current');integer(m.resources[0].max,0,'member.resources[0].max');
 unique(m.stats,'key','member.stats');if(m.stats.length!==6)fail('member.stats','must contain six stats.');
 for(const [i,a]of m.stats.entries()){const p=`member.stats[${i}]`;exact(a,['key','label','value'],p);text(a.key,false,p+'.key');text(a.label,false,p+'.label');integer(a.value,0,p+'.value');}
 unique(m.moves,'move_id','member.moves');m.moves.forEach((a,i)=>validateMove(a,`member.moves[${i}]`));
 if(m.status_condition!==null){const p='member.status_condition';exact(m.status_condition,['name','duration_remaining','duration_unit'],p);text(m.status_condition.name,false,p+'.name');if(m.status_condition.duration_remaining!==null)integer(m.status_condition.duration_remaining,0,p+'.duration_remaining');text(m.status_condition.duration_unit,false,p+'.duration_unit');}
 if(!legacy||m.attributes!==undefined)validateAttributes(m.attributes,'member.attributes');
 return m;
}
export function validateRoster(s){
 if(s.roster_config!==undefined){exact(s.roster_config,['label','hide_owner_stats'],'roster_config');if(s.roster_config.hide_owner_stats!==undefined&&typeof s.roster_config.hide_owner_stats!=='boolean')fail('roster_config.hide_owner_stats','must be boolean.');text(s.roster_config.label,false,'roster_config.label');}
 if(s.roster_level_thresholds!==undefined){const t=s.roster_level_thresholds;exact(t,Object.keys(t||{}),'roster_level_thresholds');for(const [k,v]of Object.entries(t)){if(!/^[1-9]\d*$/.test(k))fail('roster_level_thresholds','keys must be positive level numbers.');if(v!=='unknown')integer(v,0,'roster_level_thresholds value');}}
 if(s.roster!==undefined){unique(s.roster,'roster_id','roster');for(const m of s.roster)validateMember(m,s.characters.map(c=>c.character_id),{legacy:s.schema_version===1});}
}
export const ROSTER_SCALAR_FIELDS=Object.freeze(['nickname','species','ability','bond','held_item']);
// Hand-maintained display mirror of validators, not a second validation engine.
const memberShape='member: complete object {roster_id, owner_character_id, status: active|boxed, species, nickname (may be empty), level, xp_total, resources:[{id:hp,current,max}], stats:[six {key,label,value}], moves:[move objects], ability, bond: named band, held_item:text|null, status_condition:null|{name,duration_remaining,duration_unit}, attributes:[{key,label,value:text|integer,note?}]}';
const moveShape='move: {move_id,name,type,category,power:integer|text|null,accuracy:integer|text|null,pp_current,pp_max,effect}';
export const ROSTER_OPERATION_SHAPES=Object.freeze({
 configure_roster:'Required: op, character_id, reason, label: text. Optional: hide_owner_stats:boolean.',
 add_roster_member:'Required: op, character_id, reason, '+memberShape+'. New roster_id.',
 set_roster_member:'Required: op, character_id, reason, '+memberShape+'. Existing owned roster_id; preserve unchanged fields.',
 set_roster_status:'Required: op, character_id, reason, roster_id, status: active|boxed.',
 adjust_roster_hp:'Required: op, character_id, reason, roster_id, delta: nonzero signed integer. Changes current HP only.',
 adjust_move_pp:'Required: op, character_id, reason, roster_id, move_id, delta: nonzero signed integer. Changes current PP only.',
 award_roster_xp:'Required: op, character_id, reason, roster_id, delta: nonzero signed integer. No implicit level-up.',
 set_roster_level_threshold:'Required: op, character_id, reason, level: positive integer, cumulative_xp: nonnegative integer|unknown.',
 set_roster_field:'Required: op, character_id, reason, roster_id, field: nickname|species|ability|bond|held_item, value: text (held_item also accepts null; nickname may be empty).',
 add_roster_move:'Required: op, character_id, reason, roster_id, '+moveShape+'. move_id must be new on this member.'
});
export const ROSTER_OPERATIONS=Object.freeze(Object.keys(ROSTER_OPERATION_SHAPES));
export const OPERATION_SHAPES=Object.freeze({...ROSTER_OPERATION_SHAPES,
 adjust_resource:'Required: op, character_id, reason, resource: resource ID, delta: nonzero signed integer.',
 set_resource_max:'Required: op, character_id, reason, resource: resource ID, value: nonnegative integer. Does not refill current.',
 set_level:'Required: op, character_id, reason, value: positive integer.',
 set_attribute:'Required: op, character_id, reason, key: existing attribute key, value: integer|text, note: text (may be empty).',
 award_xp:'Required: op, character_id, reason, delta: nonzero signed integer.',
 adjust_currency:'Required: op, character_id, reason, delta: nonzero signed integer.',
 adjust_inventory:'Required: op, character_id, reason, item: exact item name, delta: nonzero signed integer. Optional: consumable:boolean (required for new items), notes:text.',
 advance_day:'Required: op, reason, to_day: nonnegative integer. Optional: skip_through:boolean (extra approval required). No day_token parameter.',
 set_xp:'Required: op, character_id, reason, value: nonnegative integer.',
 set_currency:'Required: op, character_id, reason, value: signed integer.',
 set_level_threshold:'Required: op, character_id, reason, level: positive integer, cumulative_xp: nonnegative integer|unknown.',
 set_ability_detail:'Required: op, character_id, reason, slot_index, application_name, status:locked|trained_unquantified|in_development. Optional: slot_name,cost,range,effect,notes,threshold_id (required for in_development).',
 log_threshold_attempt:'Required: op, character_id, reason, threshold_id, stage_index, result:success|failure, dc_revision_id.'
});
export function operationError(err,index,operation){
 if(err?.operation_index!==undefined)return err;
 const known=typeof operation?.op==='string'&&Object.hasOwn(OPERATION_SHAPES,operation.op);
 const name=known?operation.op:'unrecognized or protected operation';
 const shape=known?OPERATION_SHAPES[name]+' Optional on submitted updates: effective_day: nonnegative integer. No other keys.':null;
 const e=Error(`operations[${index}] (${name}): ${err?.message||'Invalid operation.'}`+(shape?'\n\nExpected shape\n'+shape:''));
 e.code=err?.code||'INVALID_OPERATION';e.operation_index=index;e.operation=name;
 if(err?.field_path)e.field_path=err.field_path;if(shape)e.expected_shape=shape;return e;
}
export function applyRoster(s,o){
 if(!ROSTER_OPERATIONS.includes(o.op))return false;
 text(o.character_id,false,'character_id');text(o.reason,false,'reason');if(!s.characters.some(c=>c.character_id===o.character_id))fail('character_id','must identify an existing trainer.');
 const base=['op','character_id','reason'];
 if(o.op==='configure_roster'){exact(o,[...base,'label','hide_owner_stats'],'operation');text(o.label,false,'label');if(o.hide_owner_stats!==undefined&&typeof o.hide_owner_stats!=='boolean')fail('hide_owner_stats','must be boolean.');s.roster_config={...s.roster_config,label:o.label,...(o.hide_owner_stats!==undefined?{hide_owner_stats:o.hide_owner_stats}:{})};return true;}
 if(o.op==='set_roster_level_threshold'){exact(o,[...base,'level','cumulative_xp'],'operation');integer(o.level,1,'level');if(o.cumulative_xp!=='unknown')integer(o.cumulative_xp,0,'cumulative_xp');s.roster_level_thresholds={...s.roster_level_thresholds,[o.level]:o.cumulative_xp};return true;}
 s.roster??=[];
 if(o.op==='add_roster_member'||o.op==='set_roster_member'){
  exact(o,[...base,'member'],'operation');validateMember(o.member,s.characters.map(c=>c.character_id));if(o.member.owner_character_id!==o.character_id)fail('member.owner_character_id','must match character_id.');
  const i=s.roster.findIndex(m=>m.roster_id===o.member.roster_id);
  if(o.op==='add_roster_member'){if(i!==-1)throw Error('Roster ID already exists.');s.roster.push(structuredClone(o.member));}
  else{if(i===-1||s.roster[i].owner_character_id!==o.character_id)throw Error('Roster member does not belong to this trainer.');s.roster[i]=structuredClone(o.member);}return true;
 }
 text(o.roster_id,false,'roster_id');const m=s.roster.find(m=>m.roster_id===o.roster_id&&m.owner_character_id===o.character_id);if(!m)throw Error('Roster member does not belong to this trainer.');
 if(o.op==='set_roster_field'){exact(o,[...base,'roster_id','field','value'],'operation');if(!ROSTER_SCALAR_FIELDS.includes(o.field))fail('field','must be nickname, species, ability, bond or held_item.');scalar(o.field,o.value,'value');m[o.field]=o.value;}
 else if(o.op==='add_roster_move'){exact(o,[...base,'roster_id','move'],'operation');validateMove(o.move);if(m.moves.some(move=>move.move_id===o.move.move_id))fail('move.move_id','already exists on this member.');m.moves.push(structuredClone(o.move));}
 else if(o.op==='set_roster_status'){exact(o,[...base,'roster_id','status'],'operation');if(!['active','boxed'].includes(o.status))fail('status','must be active or boxed.');m.status=o.status;}
 else{exact(o,[...base,'roster_id','delta',...(o.op==='adjust_move_pp'?['move_id']:[])],'operation');integer(o.delta,-Number.MAX_SAFE_INTEGER,'delta');if(o.delta===0)throw Error('Delta must be nonzero.');
  if(o.op==='adjust_roster_hp')m.resources[0].current+=o.delta;
  if(o.op==='award_roster_xp')m.xp_total+=o.delta;
  if(o.op==='adjust_move_pp'){text(o.move_id,false,'move_id');const move=m.moves.find(a=>a.move_id===o.move_id);if(!move)throw Error('Unknown move ID.');move.pp_current+=o.delta;}
 }
 validateMember(m);return true;
}
export function rosterProgress(m,table={}){const next=table[String(m.level+1)];return {next_level_xp:typeof next==='number'?next:null,remaining:typeof next==='number'?Math.max(0,next-m.xp_total):null,status:typeof next==='number'?'known':next==='unknown'?'unknown':'undefined'};}
