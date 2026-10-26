// Relay-only entry into the existing review UI. No save authority lives here.
export function createRelayReview({getState,proposalToUpdate,previewUpdate,operationsKey,markRelayUpdate,review,toast,refuse}) {
  return async function reviewRelayProposal(proposal) {
    try {
      const state=getState(), adapted=proposalToUpdate(proposal,state);
      if(!adapted.ok){refuse(['stale_base','wrong_lineage'].includes(adapted.reason)?'This proposal is out of date or belongs to another history — ask Claude for a new update.':'This proposal is invalid. Nothing was saved.');return;}
      const update=adapted.update,p=previewUpdate(state,update);
      if(p.status==='already_applied'){toast('Already applied on this device');return;}
      await markRelayUpdate(update.campaign_id,update.lineage_id,update.update_id,operationsKey(update.operations));
      review(p,{after:()=>toast('Saved on this device'),onStale:()=>reviewRelayProposal(proposal)});
    }catch(e){
      refuse(['WRONG_LINEAGE','STALE_REVISION','UPDATE_ID_CONFLICT','WRONG_CAMPAIGN'].includes(e?.code)?'This proposal no longer matches this campaign. Nothing was saved — ask Claude for a new update.':'This proposal could not be reviewed. Nothing was saved.');
    }
  };
}
