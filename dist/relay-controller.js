import {statusView} from './relay-sync.js';

// Transport and scheduling are supplied by the host. This module never saves campaigns.
export function createRelayController({sync,createClient,createReconciler,getCampaigns,isBusy,onChange,schedule,proposalToUpdate,fetch,now}) {
  const client = createClient({base:sync.RELAY_BASE,fetch,getCredential:sync.credential.get,setCredential:sync.credential.set,now});
  const reconciler = createReconciler({client,store:sync.store,now});
  const rows = new Map();
  let pending=false, reason='manual', scheduled=false, running=null, generation=0;
  const failure = code => ({ok:false,kind:code === 'invalid_approval' ? 'lineage' : 'other',code});
  const notify = () => {try {onChange();} catch { /* A view failure must never affect a save. */ }};
  const local = async id => (await getCampaigns()).find(s=>s.campaign_id===id);
  const rowFor = id => rows.get(id) || {problem:null,stopped:null,receiptsPending:0,publishedRevision:null,proposals:[],lastSyncMs:null};
  async function reportFailure() {
    try {for(const s of await getCampaigns()) rows.set(s.campaign_id,{...rowFor(s.campaign_id),problem:'other'});} catch {}
    notify();
  }
  async function pass() {
    const epoch=generation, before=await getCampaigns();
    if (typeof await sync.credential.get() !== 'string') return;
    const result=await sync.runReconcile(reconciler,reason);
    if(epoch!==generation) return;
    for(const s of before) {
      const previous=rowFor(s.campaign_id), next=result.campaigns?.find(r=>r.campaign_id===s.campaign_id);
      if(!next && !result.stopped && !result.problem) continue;
      const failed=!!(result.stopped || result.problem || next?.problem);
      rows.set(s.campaign_id,{...previous,problem:next?.problem || result.problem || null,stopped:result.stopped || null,
        receiptsPending:next?.receiptsPending ?? previous.receiptsPending,
        publishedRevision:next?.published || next && !failed ? s.current_revision : previous.publishedRevision,
        proposals:failed ? previous.proposals : (next?.proposals || previous.proposals),lastSyncMs:now()});
    }
    notify();
  }
  function drain() {
    if(running || !pending) return running || Promise.resolve();
    try {if(isBusy())return Promise.resolve();}catch{return reportFailure();}
    running=(async()=>{
      try {
        // At most one follow-up pass in this flight. Further demand stays queued.
        for(let i=0;i<2 && pending;i++) {
          if(isBusy()) break;
          pending=false;
          await pass();
        }
      }catch{await reportFailure();}
      finally{running=null;if(pending)enqueue();}
    })();
    return running;
  }
  function enqueue() {
    try {
      if(scheduled || running || !pending || isBusy()) return;
      scheduled=true;
      schedule(()=>{scheduled=false;return drain();});
    }catch{scheduled=false;pending=false;void reportFailure();}
  }
  function kick(nextReason) {try {reason=nextReason;pending=true;enqueue();}catch{void reportFailure();}return Promise.resolve();}
  async function outcome(action) {
    try {const r=await action();return {ok:r.kind==='ok'||r.kind==='duplicate_ok',kind:r.kind,code:r.code};}
    catch{return failure('other');}
  }
  return {
    kick,
    resume:()=>{try{enqueue();return running || Promise.resolve();}catch{return Promise.resolve();}},
    pair:async code=>{const result=await outcome(()=>client.pair(code));if(result.ok)kick('manual');notify();return result;},
    forgetDevice:async()=>{try{await sync.credential.forget();generation++;pending=false;rows.clear();notify();return {ok:true};}catch{return failure('local_failure');}},
    learnHead:async id=>{
      try {const r=await client.status(id);if(r.kind!=='ok')return {ok:false,kind:r.kind,code:r.code};const lineage=r.body?.head?.lineage_id;return typeof lineage==='string'?{ok:true,head_lineage_id:lineage}:failure('invalid_approval');}
      catch{return failure('other');}
    },
    async approveSwitch(id) {
      try {
        if(!['lineage_confirmation_required','lineage_mismatch'].includes(rowFor(id).problem)) return failure('invalid_approval');
        const state=await local(id);if(!state)return failure('invalid_approval');
        const head=await this.learnHead(id);if(!head.ok)return head;
        const current=await local(id);if(!current || current.lineage_id!==state.lineage_id)return failure('invalid_approval');
        await sync.approveLineageSwitch(id,head.head_lineage_id,state.lineage_id);
        kick('approve');return {ok:true};
      }catch(e){return failure(e?.code==='invalid_approval'?'invalid_approval':'local_failure');}
    },
    async proposals(id) {
      try {const state=await local(id);if(!state)return [];return rowFor(id).proposals.map(p=>{
        const result=proposalToUpdate(p,state);
        return {update_id:p.update_id,summary:(p.operations||[]).map(o=>`${o.op}: ${o.reason}`).join('\n'),outdated:['stale_base','wrong_lineage'].includes(result.reason),ok:result.ok,reason:result.reason || null};
      });}catch{return [];}
    },
    // Return a detached proposal for the existing human review path, never a prepared commit.
    proposal(id,updateId) {const p=rowFor(id).proposals.find(p=>p.update_id===updateId);return p ? structuredClone(p) : null;},
    async statusFor(id) {
      try {const state=await local(id),row=rowFor(id);return statusView({paired:typeof await sync.credential.get()==='string',enabled:await sync.isEnabled(id),pendingReceipts:row.receiptsPending,publishedRevision:row.publishedRevision,localRevision:state?.current_revision,problem:row.problem,stopped:row.stopped});}
      catch{return {key:'other',text:'Could not sync — local play unaffected'};}
    }
  };
}
