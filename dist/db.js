import {individualReviewIndexes} from './review-policy.js';
import {consumeUpdateReview,assertImportable,protectedOperations,hasProtectedMutation} from './operation-policy.js';
import {validateState,migrateState} from './core.js';
let database;
export function openDB(name='scroll'){return new Promise((resolve,reject)=>{
 let migrationError;const r=indexedDB.open(name,2);
 r.onupgradeneeded=()=>{
  const db=r.result,tx=r.transaction;
  if(!db.objectStoreNames.contains('campaigns'))db.createObjectStore('campaigns',{keyPath:'campaign_id'});
  if(!db.objectStoreNames.contains('preferences'))db.createObjectStore('preferences',{keyPath:'key'});
  const store=tx.objectStore('campaigns'),read=store.getAll();
  read.onsuccess=()=>{try{
   // One version-change transaction: either every stored campaign upgrades or none do.
   const changed=read.result.filter(s=>s.schema_version!==2).map(migrateState);
   changed.forEach(s=>store.put(s));
  }catch(e){migrationError=Error('Campaign storage upgrade could not complete. Existing data is unchanged. '+e.message);tx.abort();}};
 };
 r.onsuccess=()=>{database=r.result;database.onversionchange=()=>database.close();resolve();};
 r.onerror=()=>reject(migrationError||r.error);
 r.onblocked=()=>reject(new Error('Close other Scroll tabs to update storage.'));
});}
function read(store,key){return new Promise((resolve,reject)=>{const t=database.transaction(store,'readonly');const r=key===undefined?t.objectStore(store).getAll():t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export const allCampaigns=()=>read('campaigns');
export const getCampaign=id=>read('campaigns',id);
export const getPreference=async key=>(await read('preferences',key))?.value;
export function setPreference(key,value){return new Promise((resolve,reject)=>{const t=database.transaction('preferences','readwrite');t.objectStore('preferences').put({key,value});t.oncomplete=resolve;t.onabort=()=>reject(t.error||new Error('Preference save failed.'));});}
export function commit(prepared, create=false){
 validateState(prepared.next);

 return new Promise((resolve,reject)=>{
  const tx=database.transaction('campaigns','readwrite'),store=tx.objectStore('campaigns');let failure;
  const r=store.get(prepared.campaign_id);
  r.onsuccess=()=>{try{const current=r.result;
   if(create){if(current)throw new Error('This campaign already exists. Use backup restore to replace it.');}
   else if(prepared.base_revision===null){if(current)throw new Error('Campaign was created in another tab. Reload and review again.');}
   else if(!current||current.current_revision!==prepared.base_revision||current.lineage_id!==prepared.lineage_id){const error=new Error('Saved state changed in another tab. Nothing was applied. Close this preview and review again.');error.code='STALE_COMMIT';throw error;}
   const required=individualReviewIndexes(prepared,current);const protectedApproved=prepared.importEnvelope||required.length?consumeUpdateReview(prepared,required):false;
   if(hasProtectedMutation(current,prepared.next)&&!protectedApproved)throw Error('Protected facts changed without explicit human review. Nothing was saved.');
   const additions=prepared.next.transactions.slice(-1);
   for(const t of additions)if(t.source==='dm_handoff'){if(!prepared.importEnvelope)throw new Error('DM changes require the reviewed import path.');assertImportable(t.operations);}
   store.put(prepared.next);
  }catch(e){failure=e;tx.abort();}};
  tx.oncomplete=()=>resolve(prepared.next);tx.onabort=()=>reject(failure||tx.error||new Error('Could not save. No changes were applied.'));
 });
}
