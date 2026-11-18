import {normalizeRevision} from './customer-engine.js?v=1.0.12';

// Only remove one leading material prefix. Preserve suffixes and revisions.
export const strippedMaterialPart=part=>/^(TI|MI)-.+/.test(String(part))?String(part).slice(3):null;
const identity=(part,revision)=>JSON.stringify([part,normalizeRevision(revision)]);

export function planCustomerLookup(scope,rows,mode){
 const raw=mode==='raw',present=new Set(rows.map(r=>identity(raw?r.Minth_Part_No:r.part,r.revision)));
 return [...new Map(scope.map(r=>{
  const revision=normalizeRevision(r.revision),fallback=strippedMaterialPart(r.part);
  const useFallback=raw&&fallback&&!present.has(identity(r.part,revision));
  const plan={part:r.part,revision,lookupPart:useFallback?fallback:r.part,match:useFallback?'prefix fallback':'exact'};
  return [identity(r.part,revision),plan];
 })).values()];
}

export function customerAnalysisScope(plan){
 return [...new Map(plan.map(r=>[identity(r.lookupPart,r.revision),{PartNo:r.lookupPart,Revision:r.revision}])).values()];
}

export function remapCustomerRows(rows,plan){
 const groups=new Map();for(const row of rows){const k=identity(row.part,row.revision);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
 return plan.flatMap(p=>(groups.get(identity(p.lookupPart,p.revision))||[]).map(r=>({...r,part:p.part,revision:p.revision,priceSourcePart:r.part,pricePartMatch:p.match})));
}

export function tariffRouteMatch(rows,identities,requestedPart,origin,country){
 const exact=rows.filter(r=>country(r.importCountry)==='US'&&country(r.exportCountry)===origin&&identities.has(r.part));
 if(exact.length)return {rows:exact,match:'exact'};
 const fallback=strippedMaterialPart(requestedPart);
 return {rows:fallback?rows.filter(r=>country(r.importCountry)==='US'&&country(r.exportCountry)===origin&&r.part===fallback):[],match:'prefix fallback'};
}
