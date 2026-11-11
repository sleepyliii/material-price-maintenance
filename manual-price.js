import {prepare,normalizeRevision,round,latestEffective,Pending} from './material-engine.js?v=1.0.9';
import {GM_CUSTOMERS} from './customer-engine.js?v=1.0.9';

export const scopeKey=r=>JSON.stringify([r.part,normalizeRevision(r.revision)]);
const complete=r=>['complete','completed','completed / 已完成','已完成'].includes(String(r.status??'').toLowerCase());
const isGM=r=>String(r.customer??'').split(';').some(c=>GM_CUSTOMERS.includes(c.trim()));

// Manual review chooses an existing, resolved non-GM quote. It cannot invent
// a price/date or clear an unresolved PO price or GM group comparison.
export function manualPriceCandidates(input,part){
 const k=scopeKey(part),rows=input.current.filter(r=>scopeKey(r)===k);
 if(!input.scope.some(r=>scopeKey(r)===k)||rows.length<2||rows.some(r=>isGM(r)||!complete(r))||input.priceIssues?.some(r=>scopeKey(r)===k))return [];
 try{
  const values=rows.map(r=>JSON.stringify([round(r.price,4),String(r.currency).toUpperCase(),String(r.unit).toLowerCase()==='pcs'?'ea':String(r.unit).toLowerCase()]));
  if(new Set(values).size<2)return [];
  const choices=rows.map(source=>{
   const price=round(source.price,4),effective=latestEffective([source.effective]),currency=String(source.currency).toUpperCase(),unit=String(source.unit).toLowerCase();
   if(currency!=='USD'||!['ea','pcs'].includes(unit)||!source.customer||!source.po)return null;
   const row={part:source.part,revision:normalizeRevision(source.revision),customer:source.customer,po:source.po,price,currency,unit:unit==='pcs'?'pcs':'Ea',effective};
   return {...row,id:JSON.stringify(row),source};
  }).filter(Boolean);
  return [...new Map(choices.map(c=>[c.id,c])).values()];
 }catch{return [];}
}

export function prepareWithConfirmations(input,confirmations=[]){
 const selected=new Map(),audit=[];
 for(const confirmation of confirmations){
  const k=scopeKey(confirmation);
  if(selected.has(k))throw new Pending('Duplicate price confirmation / 重复客户价确认');
  const choices=manualPriceCandidates(input,confirmation),choice=choices.find(c=>c.id===confirmation.candidateId);
  if(!choice||!confirmation.confirmedAt||!Number.isFinite(Date.parse(confirmation.confirmedAt)))throw new Pending('Price confirmation no longer matches this batch / 价格确认与本次数据不匹配，请重新检查');
  selected.set(k,choice.source);
  const {source,id,...quote}=choice;
  audit.push({...quote,confirmedAt:confirmation.confirmedAt,basis:'User selected existing customer quote / 用户选择已有客户价',alternatives:choices.map(({source,id,...c})=>JSON.stringify(c)).join('\n')});
 }
 const current=input.current.filter(r=>!selected.has(scopeKey(r)));
 current.push(...selected.values());
 const report=prepare({...input,current});
 for(const row of report.ready){
  const records=audit.filter(a=>String(row.part).split('; ').includes(a.part)&&normalizeRevision(row.revision)===a.revision);
  if(records.length){row.priceConfirmation='Manual / 人工确认';row.confirmedCustomerPrice=records.map(a=>a.price).join('; ');row.confirmedCustomerPO=records.map(a=>a.po).join('; ');row.priceConfirmedAt=records.map(a=>a.confirmedAt).join('; ');}
 }
 report.manualPriceConfirmations=audit;
 return report;
}
