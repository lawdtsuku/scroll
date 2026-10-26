// Relay-only projection. Caller supplies a validated schema-1/2 campaign.
// Never serialize storage records directly: every nested record is constructed here.
import {dayToken, visibleEvents, stageProgress, thresholdProgress, chainRecordsPending} from './progress.js';

export const RELAY_PROJECTION_VERSION = 1;
export const TOKEN_TAIL = 16;
export const PAYLOAD_BUDGET = 46000;
const encoder = new TextEncoder();
const bytes = text => encoder.encode(text).length;
const fail = code => { throw new Error(code); };
function wellFormed(text) {
  if (typeof String.prototype.isWellFormed === 'function') return text.isWellFormed();
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}

export function canonicalJson(value) {
  const ancestors = new Set();
  function encode(v) {
    if (v === null || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'string') {
      if (!wellFormed(v)) fail('invalid_unicode');
      return JSON.stringify(v);
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) fail('invalid_canonical_value');
      return JSON.stringify(v);
    }
    if (!v || typeof v !== 'object') fail('invalid_canonical_value');
    if (ancestors.has(v)) fail('invalid_canonical_value');
    ancestors.add(v);
    let result;
    if (Array.isArray(v)) {
      if (Reflect.ownKeys(v).length !== v.length + 1) fail('invalid_canonical_value');
      const items = [];
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !Object.hasOwn(d, 'value')) fail('invalid_canonical_value');
        items.push(encode(d.value));
      }
      result = '[' + items.join(',') + ']';
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('invalid_canonical_value');
      const keys = Reflect.ownKeys(v);
      if (keys.some(k => typeof k !== 'string')) fail('invalid_canonical_value');
      result = '{' + keys.sort().map(k => {
        const d = Object.getOwnPropertyDescriptor(v, k);
        if (!d.enumerable || !Object.hasOwn(d, 'value')) fail('invalid_canonical_value');
        return encode(k) + ':' + encode(d.value);
      }).join(',') + '}';
    }
    ancestors.delete(v);
    return result;
  }
  return encode(value);
}

// Only scalar leaves may pass through. Optional leaves remain absent, not null.
function scalar(v) {
  if (v === null || ['string', 'boolean'].includes(typeof v) || typeof v === 'number' && Number.isFinite(v)) return v;
  return fail('invalid_state');
}
function optional(out, source, keys) {
  for (const k of keys) if (source[k] !== undefined) out[k] = scalar(source[k]);
  return out;
}
const resource = r => ({id: scalar(r.id), current: scalar(r.current), max: scalar(r.max)});
const attribute = a => optional({key: scalar(a.key), label: scalar(a.label), value: scalar(a.value)}, a, ['note']);
const inventoryItem = i => optional({item: scalar(i.item), qty: scalar(i.qty), consumable: scalar(i.consumable)}, i, ['notes']);
function levels(table) {
  const out = {};
  for (const k of Object.keys(table || {})) if (/^[1-9]\d*$/.test(k)) out[k] = scalar(table[k]);
  return out;
}
function application(a) {
  if (typeof a === 'string') return a;
  return optional({name: scalar(a.name), status: scalar(a.status), cost: scalar(a.cost), range: scalar(a.range), effect: scalar(a.effect), notes: scalar(a.notes)}, a, ['threshold_id']);
}
function slot(s) {
  const out = {index: scalar(s.index), name: scalar(s.name)};
  if (s.applications !== undefined) out.applications = s.applications.map(application);
  return out;
}
function character(c, abilities) {
  const profile = optional({}, c.profile, ['concept', 'motivation', 'notes']);
  if (c.profile.details !== undefined) profile.details = c.profile.details.map(d => ({key: scalar(d.key), value: scalar(d.value)}));
  const out = optional({character_id: scalar(c.character_id), name: scalar(c.name), level: scalar(c.level), xp_total: scalar(c.xp_total), resources: c.resources.map(resource), currency_amount: scalar(c.currency_amount), attributes: c.attributes.map(attribute), profile, inventory: c.inventory.map(inventoryItem), reference_revision: scalar(c.reference_revision)}, c, ['player_note']);
  if (abilities && c.ability_slots !== undefined) out.ability_slots = c.ability_slots.map(slot);
  return out;
}
function member(m) {
  return {roster_id: scalar(m.roster_id), owner_character_id: scalar(m.owner_character_id), status: scalar(m.status), species: scalar(m.species), nickname: scalar(m.nickname), level: scalar(m.level), xp_total: scalar(m.xp_total), resources: m.resources.map(resource), stats: m.stats.map(s => ({key: scalar(s.key), label: scalar(s.label), value: scalar(s.value)})), moves: m.moves.map(m => ({move_id: scalar(m.move_id), name: scalar(m.name), type: scalar(m.type), category: scalar(m.category), power: scalar(m.power), accuracy: scalar(m.accuracy), pp_current: scalar(m.pp_current), pp_max: scalar(m.pp_max), effect: scalar(m.effect)})), attributes: (m.attributes ?? []).map(attribute), ability: scalar(m.ability), bond: scalar(m.bond), held_item: scalar(m.held_item), status_condition: m.status_condition === null ? null : {name: scalar(m.status_condition.name), duration_remaining: scalar(m.status_condition.duration_remaining), duration_unit: scalar(m.status_condition.duration_unit)}};
}
function threshold(t) {
  const p = thresholdProgress(t);
  return optional({id: scalar(t.id), character_id: scalar(t.character_id), label: scalar(t.label), current_stage_index: p.current_stage_index, complete: p.complete, stages: t.stages.map(g => {
    const progress = stageProgress(g), dc = g.dc_revisions.at(-1);
    return {stage_index: scalar(g.stage_index), required: scalar(g.required), consecutive_required: scalar(g.consecutive_required), baseline: {successes: scalar(g.baseline.successes), streak: scalar(g.baseline.streak)}, progress: {successes: progress.successes, streak: progress.streak, complete: progress.complete}, current_dc: dc ? optional({revision_id: scalar(dc.revision_id), dc: scalar(dc.dc)}, dc, ['set_on_day']) : null, attempt_count: g.attempts.length};
  })}, t, ['completed_on_day']);
}
function lastAdvance(s) {
  const tx = s.transactions.findLast(t => t.operations.some(o => o.op === 'advance_day'));
  const span = tx ? s.journal.find(j => j.transaction_id === tx.transaction_id && j.field === 'current_day') : null;
  if (!span) return null;
  const count = s.scheduler ? Math.max(0, span.to - span.from) : 0;
  const tail = Array.from({length: Math.min(TOKEN_TAIL, count)}, (_, i) => dayToken(s, span.to - Math.min(TOKEN_TAIL, count) + i + 1));
  return {from_day: scalar(span.from), to_day: scalar(span.to), token_count: count, tokens_tail: tail, omitted_count: count - tail.length};
}
function project(s) {
  if (![1, 2].includes(s?.schema_version)) fail('invalid_state');
  const session = s.sessions.find(x => x.state === 'open'), config = s.roster_config;
  return {
    format: 'scroll-relay-projection', projection_version: RELAY_PROJECTION_VERSION,
    identity: {campaign_id: scalar(s.campaign_id), lineage_id: scalar(s.lineage_id), revision: scalar(s.current_revision), display_name: scalar(s.display_name)},
    campaign: {system_label: scalar(s.system_label), current_day: scalar(s.current_day), day_label: {singular: scalar(s.day_label.singular), plural: scalar(s.day_label.plural)}, day_zero_note: scalar(s.day_zero_note), day_token: dayToken(s), currency: {id: scalar(s.currency.id), label: scalar(s.currency.label)}, resources: s.resources.map(r => ({id: scalar(r.id), label: scalar(r.label)})), level_thresholds: levels(s.level_thresholds), ability_slots_enabled: scalar(s.ability_slots_enabled)},
    characters: s.characters.map(c => character(c, s.ability_slots_enabled)),
    roster: (s.roster || []).map(member), roster_config: config ? optional({label: scalar(config.label)}, config, ['hide_owner_stats']) : {label: 'Roster'}, roster_level_thresholds: levels(s.roster_level_thresholds),
    thresholds: (s.thresholds || []).map(threshold),
    unresolved_events: visibleEvents(s).map(e => ({id: scalar(e.id), state: scalar(e.state)})),
    last_advance: lastAdvance(s),
    open_session: session ? optional({session_id: scalar(session.session_id), opened_at: scalar(session.opened_at), opening_day: scalar(session.opening_day)}, session, ['notes', 'advance_submitted']) : null,
    pending_remainder: s.scheduler?.remainder ? {target_day: scalar(s.scheduler.remainder.target_day)} : null,
    chain_records_pending: chainRecordsPending(s), pending_migration: !!s.pending_migration
  };
}
function admission(s, data) {
  const reasons = [];
  if (typeof s.campaign_id !== 'string' || bytes(s.campaign_id) > 64) reasons.push('campaign_id_limit');
  if (typeof s.lineage_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(s.lineage_id)) reasons.push('lineage_id_format');
  if (typeof s.display_name !== 'string' || [...s.display_name].length > 100 || bytes(s.display_name) > 400) reasons.push('display_name_limit');
  try { canonicalJson(data); } catch (e) { reasons.push(e.message === 'invalid_unicode' ? 'invalid_unicode' : 'invalid_state'); }
  return reasons.length ? {ok: false, reasons} : {ok: true};
}
export function relayAdmission(state) {
  try { return admission(state, project(state)); } catch { return {ok: false, reasons: ['invalid_state']}; }
}
export function buildRelayProjection(state) {
  try {
    const data = project(state);
    if (!admission(state, data).ok) return {ok: false, code: 'not_relay_eligible'};
    const payload = canonicalJson(data), payload_bytes = bytes(payload), sections = {};
    // Fixed labels plus numeric indexes only. These measurements overlap; do not sum them.
    for (const key of ['format','projection_version','identity','campaign','characters','roster','roster_config','roster_level_thresholds','thresholds','unresolved_events','last_advance','open_session','pending_remainder','chain_records_pending','pending_migration']) sections[key] = bytes(canonicalJson(data[key]));
    data.characters.forEach((c, i) => {
      sections[`characters[${i}]`] = bytes(canonicalJson(c));
      sections[`characters[${i}].profile`] = bytes(canonicalJson(c.profile));
      if (c.ability_slots !== undefined) sections[`characters[${i}].ability_slots`] = bytes(canonicalJson(c.ability_slots));
    });
    if (payload_bytes > PAYLOAD_BUDGET) return {ok: false, code: 'too_large', payload_bytes, sections};
    return {ok: true, data, payload, payload_bytes, sections};
  } catch { return {ok: false, code: 'invalid_state'}; }
}
export async function hashPayload(payload) {
  if (typeof payload !== 'string' || !wellFormed(payload)) fail('invalid_payload');
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return 'sha256:' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
