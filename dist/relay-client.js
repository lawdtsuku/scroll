// Transport adapters only. No campaign commit or approval authority is granted here.
import {relayAdmission, buildRelayProjection, hashPayload, RELAY_PROJECTION_VERSION} from './relay-projection.js';

const utf8Bytes = text => new TextEncoder().encode(text).length;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const flat = value => typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;

export function proposalToUpdate(proposal, state) {
  if (!plain(proposal) || !plain(state)) return {ok: false, reason: 'invalid_proposal'};
  if (proposal.lineage_id !== state.lineage_id) return {ok: false, reason: 'wrong_lineage'};
  if (proposal.base_revision !== state.current_revision) return {ok: false, reason: 'stale_base'};
  if (typeof proposal.update_id !== 'string' || !Array.isArray(proposal.operations)) return {ok: false, reason: 'invalid_proposal'};
  const operations = [];
  for (const operation of proposal.operations) {
    if (!plain(operation) || typeof operation.op !== 'string' || typeof operation.reason !== 'string') return {ok: false, reason: 'invalid_proposal'};
    const entries = [['op', operation.op], ['reason', operation.reason]];
    if (operation.character_id !== undefined) {
      if (typeof operation.character_id !== 'string') return {ok: false, reason: 'invalid_proposal'};
      entries.push(['character_id', operation.character_id]);
    }
    const args = operation.args === undefined ? {} : operation.args;
    if (!plain(args)) return {ok: false, reason: 'invalid_args'};
    for (const [key, value] of Object.entries(args)) {
      if (['op', 'reason', 'character_id'].includes(key)) return {ok: false, reason: 'arg_collision'};
      // effective_day is the explicitly permitted exception: Scroll validates it later.
      if (!flat(value)) return {ok: false, reason: 'invalid_args'};
      entries.push([key, value]);
    }
    operations.push(Object.fromEntries(entries));
  }
  return {ok: true, update: {format: 'scroll-session-update', version: 1, campaign_id: state.campaign_id, lineage_id: proposal.lineage_id, update_id: proposal.update_id, base_revision: proposal.base_revision, operations}};
}

export function projectReceipt(storedReceipt) {
  try {
    const r = storedReceipt;
    if (!plain(r) || r.format !== 'scroll-update-receipt' || r.version !== 1 || !['applied', 'interrupted'].includes(r.status)) return null;
    for (const key of ['campaign_id', 'lineage_id', 'update_id']) if (typeof r[key] !== 'string') return null;
    if (!integer(r.current_revision) || !integer(r.current_day) || !Array.isArray(r.confirmed_changes)) return null;
    const clip = value => Array.from(value).slice(0, 500).join('');
    const result = {format: r.format, version: r.version, campaign_id: clip(r.campaign_id), lineage_id: clip(r.lineage_id), update_id: clip(r.update_id), current_revision: r.current_revision, current_day: r.current_day, status: r.status};
    if (r.app_version !== undefined) {
      if (typeof r.app_version !== 'string') return null;
      result.app_version = clip(r.app_version);
    }
    if (r.interruption !== undefined && r.interruption !== null) {
      if (!plain(r.interruption)) return null;
      result.interruption = {};
      if (r.interruption.day_reached !== undefined) {
        if (!integer(r.interruption.day_reached)) return null;
        result.interruption.day_reached = r.interruption.day_reached;
      }
      if (r.interruption.token !== undefined) {
        if (typeof r.interruption.token !== 'string') return null;
        result.interruption.token = clip(r.interruption.token);
      }
    }
    result.confirmed_changes = [];
    for (const c of r.confirmed_changes.slice(0, 50)) {
      if (!plain(c) || c.character_id !== null && typeof c.character_id !== 'string' || typeof c.field !== 'string' || typeof c.reason !== 'string') return null;
      result.confirmed_changes.push({character_id: c.character_id === null ? null : clip(c.character_id), field: clip(c.field), reason: clip(c.reason)});
    }
    result.confirmed_changes_omitted = Math.max(0, r.confirmed_changes.length - 50);
    return utf8Bytes(JSON.stringify(result)) < 8192 ? result : null;
  } catch { return null; }
}

export async function buildSnapshotRequest(state, {labelOf} = {}) {
  // labelOf is intentionally not used: the authoritative label is display_name.
  void labelOf;
  try {
    if (!relayAdmission(state).ok) return {ok: false, code: 'not_eligible'};
    const projected = buildRelayProjection(state);
    if (!projected.ok) return {ok: false, code: projected.code === 'too_large' ? 'too_large' : 'not_eligible'};
    const body = {campaign_id: state.campaign_id, label: state.display_name, lineage_id: state.lineage_id, revision: state.current_revision, projection_version: RELAY_PROJECTION_VERSION, projection_hash: await hashPayload(projected.payload), payload: projected.payload};
    return {ok: true, body, bytes: utf8Bytes(JSON.stringify(body))};
  } catch { return {ok: false, code: 'not_eligible'}; }
}

const successCodes = new Set(['accepted', 'switched', 'receipt_recorded', 'duplicate_ok']);
const errorCodes = new Set(['invalid_or_used_code', 'bad_credential', 'revoked_credential', 'not_record_keeper', 'rejected_stale', 'lineage_mismatch', 'rejected_abandoned_lineage', 'switch_conflict', 'conflict_same_revision', 'receipt_conflict', 'rejected_superseded', 'payload_too_large', 'forbidden_content']);
const outcome = (kind, code = kind) => ({kind, code, retry: kind === 'offline' || kind === 'server'});
export function classifyResponse({status, body, networkError}) {
  if (networkError) return outcome('offline');
  if (status >= 200 && status < 300 && body?.ok === true) {
    if (body.status === 'duplicate_ok') return outcome('duplicate_ok');
    if (body.status === undefined || successCodes.has(body.status)) return outcome('ok', body.status || 'ok');
  }
  const code = errorCodes.has(body?.code) ? body.code : undefined;
  if (status === 401) return outcome('unauthorized', code);
  if (status === 403) return outcome('not_record_keeper', code);
  if (status === 409) {
    if (code === 'rejected_stale') return outcome('stale', code);
    if (['lineage_mismatch','rejected_abandoned_lineage','switch_conflict'].includes(code)) return outcome('lineage', code);
    if (['conflict_same_revision','receipt_conflict','rejected_superseded'].includes(code)) return outcome('conflict', code);
  }
  if (status === 413) return outcome('too_large', code);
  if (status === 422) return outcome('forbidden', code);
  if ([400,404].includes(status)) return outcome('bad_request', code);
  return outcome('server', status >= 200 && status < 300 ? 'malformed_response' : 'server');
}

// Inject timeoutSignal(ms) on platforms without AbortSignal.timeout; its timer
// belongs to the host. Credentials are read afresh for every authenticated call.
export function createRelayClient({base, fetch, getCredential, setCredential, now, timeoutSignal}) {
  if (typeof base !== 'string' || !/^https:\/\/[a-z0-9.-]+$/.test(base)) throw new Error('Invalid relay base');
  void now;
  const failure = code => ({...outcome('server', code), body: null});
  async function request(path, data, pair = false, acceptedStatuses) {
    let credential;
    try {
      if (!pair) {
        credential = await getCredential();
        if (typeof credential !== 'string' || !credential) return {...outcome('unauthorized'), body:null};
      }
      const signal = timeoutSignal ? timeoutSignal(15000) : typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(15000) : null;
      if (!signal) return failure('timeout_unavailable');
      const headers = {'Content-Type':'application/json'};
      if (!pair) headers.Authorization = `Bearer ${credential}`;
      let response;
      try {
        response = await fetch(base + path, {method:data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : {body:JSON.stringify(data)}), credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal});
      } catch { return {...outcome('offline'), body:null}; }
      let body;
      try { body = await response.json(); } catch { return response.status >= 200 && response.status < 300 ? failure('malformed_response') : {...classifyResponse({status:response.status}), body:null}; }
      const classified = classifyResponse({status:response.status, body});
      if (classified.kind !== 'ok' && classified.kind !== 'duplicate_ok') return {...classified, body:null};
      if (!plain(body)) return failure('malformed_response');
      if (acceptedStatuses && !acceptedStatuses.includes(body.status)) return failure('malformed_response');
      if (pair) {
        if (typeof body.device_credential !== 'string' || !body.device_credential || typeof body.device_id !== 'string') return failure('malformed_response');
        await setCredential(body.device_credential);
        return {...classified, body:{ok:true, device_id:body.device_id === body.device_credential ? '[redacted]' : body.device_id}};
      }
      // Never return credential echoes, even from malformed or hostile responses.
      const serialized = JSON.stringify(body);
      if (serialized.includes(credential) || /"device_credential"\s*:/.test(serialized)) return failure('malformed_response');
      return {...classified, body};
    } catch { return failure('client_error'); }
  }
  return {
    pair:code => request('/device/pair', {code}, true),
    ping:() => request('/device/ping'),
    publishSnapshot:body => request('/device/snapshot', body, false, ['accepted','duplicate_ok']),
    switchLineage:(body, expectedLineage) => {
      const {lineage_id, ...rest} = body;
      return request('/device/lineage-switch', {...rest, new_lineage_id:lineage_id, expected_lineage_id:expectedLineage}, false, ['switched','duplicate_ok']);
    },
    fetchProposals:campaignId => request('/device/proposals?campaign_id=' + encodeURIComponent(campaignId)),
    postReceipt:body => {
      try { if (utf8Bytes(JSON.stringify(body.receipt)) >= 8192) return Promise.resolve({...outcome('too_large'), body:null}); }
      catch { return Promise.resolve({...outcome('bad_request'), body:null}); }
      return request('/device/receipt', body, false, ['receipt_recorded','duplicate_ok']);
    },
    status:campaignId => request('/device/status?campaign_id=' + encodeURIComponent(campaignId))
  };
}

/** Injected async store contract (no transaction spans a network call):
 * listEligible() -> [{campaign_id,state}] validated migrated states.
 * getSyncRecord(id) -> {published:{lineage_id,revision,hash}|null,
 *   unsentReceipts:[{update_id,lineage_id,committed_revision,receipt}],
 *   lastLineagePublished, lineageApproval?:{expected_lineage_id,new_lineage_id}}.
 * lineageApproval must be written only following explicit human confirmation.
 * putSyncRecord(id,record) persists reconciliation metadata, never campaign data.
 * The host serializes reconciliation metadata writes; receipts remain reconstructible
 * from committed campaign state. This library is not an authoritative outbox.
 */
export function createReconciler({client, store, now}) {
  void now;
  let running = null, dirty = false;
  async function pass() {
    const result = {campaigns:[], stopped:null};
    for (const {campaign_id, state} of await store.listEligible()) {
      const row = {campaign_id, published:false, receiptsSent:0, receiptsPending:0, proposals:[], problem:null};
      result.campaigns.push(row);
      const record = structuredClone(await store.getSyncRecord(campaign_id) || {published:null, unsentReceipts:[], lastLineagePublished:null});
      record.unsentReceipts ||= [];
      row.receiptsPending = record.unsentReceipts.length;
      const halt = response => {
        if (['ok','duplicate_ok'].includes(response.kind)) return false;
        row.problem = response.code;
        if (response.kind === 'unauthorized') result.stopped = 'unauthorized';
        if (response.kind === 'offline') result.stopped = 'offline';
        return result.stopped || response.kind === 'not_record_keeper';
      };
      let blocked = false;
      for (const queued of [...record.unsentReceipts]) {
        const receipt = projectReceipt(queued.receipt);
        if (!receipt) {row.problem = 'invalid_receipt'; blocked = true; break;}
        const response = await client.postReceipt({campaign_id, lineage_id:queued.lineage_id, update_id:queued.update_id, committed_revision:queued.committed_revision, receipt});
        if (halt(response)) {blocked = true; break;}
        if (response.kind === 'duplicate_ok' || response.kind === 'ok' && response.code === 'receipt_recorded') {
          record.unsentReceipts = record.unsentReceipts.filter(r => r.update_id !== queued.update_id);
          row.receiptsSent++;
        } else if (response.kind === 'conflict') {
          record.unsentReceipts = record.unsentReceipts.filter(r => r.update_id !== queued.update_id);
          row.problem = response.code;
        } else {row.problem = response.code; blocked = true; break;}
        row.receiptsPending = record.unsentReceipts.length;
        await store.putSyncRecord(campaign_id, structuredClone(record));
      }
      if (result.stopped) return result;
      if (blocked) continue;
      const snapshot = await buildSnapshotRequest(state);
      if (!snapshot.ok) {row.problem = snapshot.code; continue;}
      const body = snapshot.body, previous = record.published;
      const expected = previous?.lineage_id || record.lastLineagePublished;
      let publish = !previous || previous.lineage_id !== body.lineage_id || previous.revision !== body.revision || previous.hash !== body.projection_hash;
      if (previous?.lineage_id === body.lineage_id && previous.revision > body.revision) {row.problem = 'rejected_stale'; continue;}
      if (previous?.lineage_id === body.lineage_id && previous.revision === body.revision && previous.hash !== body.projection_hash) {row.problem = 'conflict_same_revision'; continue;}
      if (publish) {
        const switching = expected && expected !== body.lineage_id;
        if (switching && (record.lineageApproval?.expected_lineage_id !== expected || record.lineageApproval?.new_lineage_id !== body.lineage_id)) {row.problem = 'lineage_confirmation_required'; continue;}
        const response = switching ? await client.switchLineage(body, expected) : await client.publishSnapshot(body);
        if (halt(response)) {if (result.stopped) return result; continue;}
        if (!['ok','duplicate_ok'].includes(response.kind)) {row.problem = response.code; continue;}
        record.published = {lineage_id:body.lineage_id, revision:body.revision, hash:body.projection_hash};
        record.lastLineagePublished = body.lineage_id;
        delete record.lineageApproval;
        await store.putSyncRecord(campaign_id, structuredClone(record));
        row.published = true;
      }
      const response = await client.fetchProposals(campaign_id);
      if (halt(response)) {if (result.stopped) return result; continue;}
      if (response.kind === 'ok' && Array.isArray(response.body?.proposals)) row.proposals = response.body.proposals;
      else row.problem = response.code === 'ok' ? 'malformed_response' : response.code;
    }
    return result;
  }
  return {reconcile(trigger) {
    void trigger;
    if (running) {dirty = true; return running;}
    running = (async () => {
      try {
        let result = await pass();
        if (dirty && !result.stopped) {
          dirty = false;
          const next = await pass();
          const prior = new Map(result.campaigns.map(row => [row.campaign_id, row]));
          for (const row of next.campaigns) {
            const before = prior.get(row.campaign_id);
            if (before) {
              row.published ||= before.published;
              row.receiptsSent += before.receiptsSent;
              row.problem ||= before.problem;
              prior.delete(row.campaign_id);
            }
          }
          next.campaigns.push(...prior.values());
          result = next;
        }
        return result;
      } catch {return {campaigns:[], stopped:null, problem:'reconciliation_error'};}
      finally {running = null; dirty = false;}
    })();
    return running;
  }};
}
