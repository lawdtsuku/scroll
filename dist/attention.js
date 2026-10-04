import {visibleEvents} from './progress.js';
import {exchangeStatus,newExchange} from './exchange.js';
export const pendingChainIds=s=>(s.scheduler?.events||[]).filter(e=>e.selection_rule==='trigger_chain'&&e.state==='scheduled').map(e=>e.id);
export function reconcileAcknowledgement(s,ids=[]){const pending=new Set(pendingChainIds(s));return Array.isArray(ids)?ids.filter(id=>pending.has(id)):[];}
export function handoffState(s,acknowledged=[]){const chains=pendingChainIds(s),known=new Set(acknowledged);return {events:visibleEvents(s),chains,unhandled:chains.some(id=>!known.has(id)),remainder:!!s.scheduler?.remainder};}
export const needsHandoff=h=>h.events.length>0||h.unhandled||h.remainder;
export function tabBadges(s,ack,exchange,referencePending){const attention=needsHandoff(handoffState(s,ack));return {play:attention,updates:!exchangeStatus(exchange||newExchange(s),attention).allDone,reference:referencePending};}
export const ownerThresholdReached=(s,c)=>s.roster_config?.hide_owner_stats!==true&&typeof s.level_thresholds?.[String(c.level+1)]==='number'&&c.xp_total>=s.level_thresholds[String(c.level+1)];
