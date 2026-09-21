// Shared character/roster attribute contract. Values are literal, never computed.
export function validateAttributes(attributes,path='attributes') {
 const fail=(p,message)=>{const e=Error(p+': '+message);e.field_path=p;throw e;};
 if(!Array.isArray(attributes)||attributes.length>100000)fail(path,'must be a list of at most 100000 attributes.');
 const seen=new Set();
 for(const [i,a] of attributes.entries()) {
  const p=`${path}[${i}]`;
  if(!a||typeof a!=='object'||Array.isArray(a))fail(p,'must be an object.');
  if(Object.keys(a).some(k=>!['key','label','value','note'].includes(k)))fail(p,'has an unexpected field.');
  for(const key of ['key','label'])if(typeof a[key]!=='string'||!a[key].trim()||a[key].length>100000)fail(p+'.'+key,'must be nonempty text.');
  if(seen.has(a.key))fail(path,'has a duplicate attribute key.');seen.add(a.key);
  if(typeof a.value==='number'){if(!Number.isSafeInteger(a.value))fail(p+'.value','must be a safe whole number or text.');}
  else if(typeof a.value!=='string'||a.value.length>100000)fail(p+'.value','must be a safe whole number or text.');
  if(a.note!==undefined&&(typeof a.note!=='string'||a.note.length>100000))fail(p+'.note','must be text.');
 }
 return attributes;
}
