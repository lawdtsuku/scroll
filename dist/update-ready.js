// UI-only activation control. Campaign state and approval handlers are not mutated here.
export function updateBlocked({dialog=false,dirty=false,saving=false,draft=false,batch=false,reading=false,selectedFile=false}={}){return !!(dialog||dirty||saving||draft||batch||reading||selectedFile);}
export function mountUpdateReady(registration,{isBlocked,roots,container=document.body}){
 const panel=document.createElement('section');panel.className='notice update-ready';panel.hidden=true;panel.setAttribute('aria-label','Application update');
 panel.innerHTML='<strong>Update ready</strong><p>Update now will reload Scroll with the new build after your edits are saved or discarded.</p><p class="small" data-update-status role="status"></p><button type="button" class="primary">Update now</button>';
 container.prepend(panel);const button=panel.querySelector('button'),status=panel.querySelector('[data-update-status]');
 let waiting=registration.waiting,requested=false,needsReload=false,controller=navigator.serviceWorker.controller,frozen=[],timer,message='';
 const freeze=()=>{frozen=roots().filter(Boolean).map(el=>[el,el.inert]);for(const [el]of frozen)el.inert=true;};
 const unfreeze=()=>{for(const [el,prior]of frozen)el.inert=prior;frozen=[];};
 const refresh=()=>{waiting=registration.waiting||waiting;panel.hidden=!(waiting||needsReload||requested);const blocked=isBlocked();button.disabled=requested||blocked;const text=requested?'Updating… keep this window open.':blocked?'Finish or cancel the open preview, form or unsaved changes before updating.':message; if(status.textContent!==text)status.textContent=text;};
 const stop=reason=>{clearTimeout(timer);requested=false;unfreeze();message=reason;refresh();};
 const reloadIfSafe=()=>{if(isBlocked()){stop('The new build is ready. Finish or cancel your changes, then tap Update now.');return;}location.reload();};
 button.addEventListener('click',event=>{if(!event.isTrusted||requested||isBlocked())return;
  if(needsReload){freeze();reloadIfSafe();return;}
  if(typeof MessageChannel==='undefined'){message='This browser cannot activate an update here. Close all Scroll windows and reopen.';refresh();return;}
  waiting=registration.waiting;if(!waiting){message='Close all Scroll windows and reopen to finish updating.';refresh();return;}
  requested=true;message='';freeze();refresh();const channel=new MessageChannel();timer=setTimeout(()=>{channel.port1.close();stop('Update did not finish. Your page is still open; try again or close all Scroll windows and reopen.');},10000);
  channel.port1.onmessage=event=>{if(event.data?.type==='SCROLL_ACTIVATE_DENIED'){channel.port1.close();stop(event.data.reason==='other-windows'?'Close other Scroll windows, including the snapshot viewer, then try again.':'Update could not be activated safely. Close all Scroll windows and reopen.');}};
  try{waiting.postMessage({type:'SCROLL_ACTIVATE'},[channel.port2]);}catch{channel.port1.close();stop('Update could not be activated. Your page remains open.');}
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{const next=navigator.serviceWorker.controller;if(next===controller)return;const hadController=!!controller;controller=next;if(!hadController&&!requested)return;needsReload=true;waiting=null;clearTimeout(timer);if(requested)reloadIfSafe();else{message='The new build is ready. Tap Update now when your work is saved.';refresh();}});
 registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',refresh));
 // Poll only local UI flags; never check the network or activate on a timer.
 setInterval(refresh,250);refresh();return panel;
}
