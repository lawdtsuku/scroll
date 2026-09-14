import {consumeUpdateReview,assertImportable,protectedOperations,hasProtectedMutation} from './operation-policy.js';
import {validateState} from './core.js';
let database;
export function openDB(name='scroll'){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('campaigns',{keyPath:'campaign_id'});r.result.createObjectStore('preferences',{keyPath:'key'});};r.onsuccess=()=>{database=r.result;database.onversionchange=()=>database.close();resolve();};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other Scroll tabs to update storage.'));});}
function read(store,key){return new Promise((resolve,reject)=>{const t=database.transaction(store,'readonly');const r=key===undefined?t.objectStore(store).getAll():t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export const allCampaigns=()=>read('campaigns');
export const getCampaign=id=>read('campaigns',id);
export const getPreference=async key=>(await read('preferences',key))?.value;
export function setPreference(key,value){return new Promise((resolve,reject)=>{const t=database.transaction('preferences','readwrite');t.objectStore('preferences').put({key,value});t.oncomplete=resolve;t.onabort=()=>reject(t.error||new Error('Preference save failed.'));});}
export function commit(prepared, create=false){
 validateState(prepared.next);
 const reviewRequired=!!prepared.importEnvelope||protectedOperations(prepared.next.transactions.at(-1).operations).length>0;const protectedApproved=reviewRequired?consumeUpdateReview(prepared):false;
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('campaigns','readwrite'),store=tx.objectStore('campaigns');let failure;
  const r=store.get(prepared.campaign_id);
  r.onsuccess=()=>{try{const current=r.result;
   if(create){if(current)throw new Error('This campaign already exists. Use backup restore to replace it.');}
   else if(prepared.base_revision===null){if(current)throw new Error('Campaign was created in another tab. Reload and review again.');}
   else if(!current||current.current_revision!==prepared.base_revision||current.lineage_id!==prepared.lineage_id){const error=new Error('Saved state changed in another tab. Nothing was applied. Close this preview and review again.');error.code='STALE_COMMIT';throw error;}
   if(hasProtectedMutation(current,prepared.next)&&!protectedApproved)throw Error('Protected facts changed without explicit human review. Nothing was saved.');
   const additions=prepared.next.transactions.slice(-1);
   for(const t of additions)if(t.source==='dm_handoff'){if(!prepared.importEnvelope)throw new Error('DM changes require the reviewed import path.');assertImportable(t.operations);}
   store.put(prepared.next);
  }catch(e){failure=e;tx.abort();}};
  tx.oncomplete=()=>resolve(prepared.next);tx.onabort=()=>reject(failure||tx.error||new Error('Could not save. No changes were applied.'));
 });
}
