// Preference adapter only: no campaign writes and no authoritative receipt outbox.
export const RELAY_BASE = 'https://scroll-connector-test.mitchellmontellano.workers.dev';
export const CREDENTIAL_KEY = 'relay-credential';
export const enabledKey = id => `relay-enabled:${id}`;
export const syncKey = id => `relay-sync:${id}`;
export const offeredKey = id => `relay-offered:${id}`;
const receiptKey = r => `${r.lineage_id}:${r.update_id}`;
const own = (o, key) => Object.hasOwn(o, key);

export function eligibleReceipts(state, record = {}, offeredMap = {}) {
  if (!state) return [];
  const sent = new Set(record.sent || []);
  return (state.transactions || []).filter(t => {
    const u = t.update, r = u?.receipt;
    if (!r || t.campaign_id !== state.campaign_id || t.source !== 'dm_handoff') return false;
    if (u.lineage_id !== state.lineage_id || r.lineage_id !== state.lineage_id) return false;
    if (u.update_id !== r.update_id) return false;
    const key = receiptKey(u);
    return own(offeredMap, key) && offeredMap[key] === u.operations_key && !sent.has(key);
  }).map(t => ({update_id:t.update.update_id, lineage_id:t.update.lineage_id,
    committed_revision:t.update.receipt.current_revision, receipt:structuredClone(t.update.receipt)}));
}

const persistedRecord = (rec, sent) => ({published:rec.published ?? null,
  lastLineagePublished:rec.lastLineagePublished ?? null,
  ...(rec.lineageApproval ? {lineageApproval:{expected_lineage_id:rec.lineageApproval.expected_lineage_id,new_lineage_id:rec.lineageApproval.new_lineage_id}} : {}), sent:[...sent]});

export function createRelaySync({getPreference, setPreference, allCampaigns, getCampaign, locks, operationsKey, now}) {
  // Caller computes operationsKey(validatedUpdate.operations) before markRelayUpdate.
  void operationsKey; void now;
  const issued = new Map(), chains = new Map();
  const faults = new WeakSet();
  const fault = code => {const e = new Error('Relay local operation failed.');e.code = code;faults.add(e);return e;};
  const safe = async fn => {try {return await fn();} catch(e) {throw faults.has(e) ? e : fault('local_failure');}};
  function locked(name, fn) {
    return safe(() => {
      if (locks) return locks.request(name, fn);
      // In-process only: NO cross-tab exclusion. Worker atomic revision/lineage
      // rules remain the correctness boundary when Web Locks are unavailable.
      const next = (chains.get(name) || Promise.resolve()).then(fn);
      const tail = next.catch(() => {});
      chains.set(name, tail);
      tail.then(() => {if (chains.get(name) === tail) chains.delete(name);});
      return next;
    });
  }
  const isEnabled = id => safe(async () => (await getPreference(enabledKey(id))) === true);
  const store = {
    listEligible:() => safe(async () => {
      const entries = [];
      for (const state of await allCampaigns()) if (await isEnabled(state.campaign_id)) entries.push({campaign_id:state.campaign_id,state});
      return entries;
    }),
    getSyncRecord:id => safe(async () => {
      const record = await getPreference(syncKey(id)) || {};
      const offered = await getPreference(offeredKey(id)) || {};
      const unsentReceipts = eligibleReceipts(await getCampaign(id), record, offered);
      issued.set(id, unsentReceipts.map(receiptKey));
      const {sent, ...result} = persistedRecord(record, []);
      return {...result,unsentReceipts};
    }),
    putSyncRecord:(id, rec) => safe(async () => {
      // Called inside runReconcile's lock. Never acquire a nested lock here.
      if (!issued.has(id)) throw new Error('Sync record was not read.');
      const old = await getPreference(syncKey(id)) || {};
      const pending = new Set(rec.unsentReceipts.map(receiptKey));
      // sent means SETTLED: delivered OR terminally rejected, not only delivered.
      // Keep issued through every put in this pass; a new local receipt is not issued.
      const sent = new Set(old.sent || []);
      for (const key of issued.get(id)) if (!pending.has(key)) sent.add(key);
      await setPreference(syncKey(id), persistedRecord(rec, sent));
    })
  };
  return {RELAY_BASE, CREDENTIAL_KEY, enabledKey, syncKey, offeredKey, store,
    credential:{
      get:() => safe(async () => {const value = await getPreference(CREDENTIAL_KEY);return typeof value === 'string' && value ? value : null;}),
      set:value => safe(async () => {if (typeof value !== 'string' || !value) throw new Error('Invalid credential.');await setPreference(CREDENTIAL_KEY,value);}),
      // Removes this phone's credential only; does NOT revoke it on the Worker.
      forget:() => safe(() => setPreference(CREDENTIAL_KEY,null))
    },
    isEnabled,
    setEnabled:(id, value) => safe(async () => {if (typeof value !== 'boolean') throw new Error('Invalid enablement.');await setPreference(enabledKey(id),value);}),
    markRelayUpdate:(id,lineage,updateId,operations_key) => locked(`scroll-relay-offered:${id}`,async () => {
      if (![id,lineage,updateId,operations_key].every(v => typeof v === 'string' && v.length)) throw fault('invalid_identity');
      const map = await getPreference(offeredKey(id)) || {}, key = receiptKey({lineage_id:lineage,update_id:updateId});
      if (own(map,key) && map[key] !== operations_key) throw fault('offer_conflict');
      // A marker proves an identical offer, not which path later committed it.
      await setPreference(offeredKey(id), {...map,[key]:operations_key});
    }),
    approveLineageSwitch:(id,expected,newLineage) => locked('scroll-relay-reconcile',async () => {
      const state = await getCampaign(id);
      if (!state || state.lineage_id !== newLineage || typeof expected !== 'string' || !expected) throw fault('invalid_approval');
      const record = await getPreference(syncKey(id)) || {};
      await setPreference(syncKey(id),persistedRecord({...record,lastLineagePublished:expected,lineageApproval:{expected_lineage_id:expected,new_lineage_id:newLineage}},record.sent || []));
    }),
    runReconcile:(reconciler,trigger) => locked('scroll-relay-reconcile',() => reconciler.reconcile(trigger))
  };
}

const texts = {
  not_paired:'Not connected to Claude', disabled:'Connected — syncing off for this campaign',
  synced:'Synced with Claude', waiting:'Saved locally — waiting to sync',
  offline:'Offline — changes are safe on this device', unreachable:'Could not reach relay — retry available',
  device_rejected:'Device access rejected — pairing required', forbidden:'Device not authorized for this campaign',
  not_keeper:'Another device is the campaign record keeper', lineage_confirm:'Campaign history changed — confirmation required',
  outdated:'Proposal is out of date — request a new update', too_large:'Campaign state exceeds relay size limit',
  unavailable:'Relay temporarily unavailable — local play unaffected',
  receipt_problem:'Saved locally — a receipt could not be sent, so Claude has not been notified', other:'Could not sync — local play unaffected'
};
export function statusView({paired,enabled,online,pendingReceipts=0,publishedRevision,localRevision,problem,stopped}) {
  // online alone is not proof of a failed request; never mask an HTTP error.
  void online;
  let key;
  if (!paired) key = 'not_paired';
  else if (!enabled) key = 'disabled';
  else if (stopped === 'unauthorized' || ['unauthorized','bad_credential','revoked_credential','invalid_or_used_code'].includes(problem)) key = 'device_rejected';
  else if (problem === 'not_record_keeper') key = 'not_keeper';
  else if (problem === 'forbidden' || problem === 'forbidden_content') key = 'forbidden';
  else if (stopped === 'offline' || problem === 'offline') key = 'offline';
  else if (problem === 'invalid_receipt' || ['too_large','payload_too_large'].includes(problem) && pendingReceipts > 0) key = 'receipt_problem';
  else if (['too_large','payload_too_large'].includes(problem)) key = 'too_large';
  else if (['lineage_confirmation_required','lineage_mismatch','rejected_abandoned_lineage','switch_conflict','lineage'].includes(problem)) key = 'lineage_confirm';
  else if (['rejected_stale','stale','stale_base','rejected_superseded'].includes(problem)) key = 'outdated';
  else if (problem === 'receipt_conflict') key = 'receipt_problem';
  else if (['server','malformed_response'].includes(problem)) key = 'unavailable';
  else if (problem === 'timeout_unavailable') key = 'unreachable';
  else if (problem || stopped) key = 'other';
  else key = pendingReceipts > 0 || publishedRevision == null || publishedRevision !== localRevision ? 'waiting' : 'synced';
  return {key,text:texts[key]};
}
export function lineageConsequenceText(campaignName) {
  return `${campaignName}: this restored campaign becomes the new authoritative history. Proposals queued against the old history will no longer apply. The old history is abandoned permanently. The campaign stays saved on this device whether or not you approve.`;
}
