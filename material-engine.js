import {normalizeRevision,decimal,parseDate,iso} from './customer-engine.js';
export {normalizeRevision};
const key=(...v)=>JSON.stringify(v);
const group=(rows,fn)=>{const m=new Map();for(const r of rows){const k=fn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
export class Pending extends Error{}
function parts(s){s=String(s).trim();if(s.startsWith('.'))s='0'+s;const canonical=decimal(s);if(canonical.startsWith('-'))throw new Pending('Negative number / 数值为负');const [a,b='']=canonical.split('.');return {n:BigInt(a+b),scale:b.length};}
function format(n,scale){const s=n.toString().padStart(scale+1,'0');return scale?s.slice(0,-scale)+'.'+s.slice(-scale):s;}
function roundFraction(n,d){const q=n/d;return q+(n%d*2n>=d?1n:0n);}
export function round(s,digits){const p=parts(s);return format(roundFraction(p.n*10n**BigInt(digits),10n**BigInt(p.scale)),digits);}
export function multiply(a,b){const x=parts(a),y=parts(b);return format(x.n*y.n,x.scale+y.scale);}
export function calculate(price,sourceRate,origin){
 const factor=({'泰国':'0.91','Thailand':'0.91','中国':'0.93','China':'0.93'})[origin];
 if(!factor)throw new Pending('Settlement factor unconfirmed / 出口国留利比例待确认: '+origin);
 const selected=sourceRate==='0/0.278464'?'0.278':sourceRate;
 const tariff=round(selected,2), t=parts(tariff), f=parts(factor);
 const ratio=format(roundFraction(f.n*10n**BigInt(t.scale)*100n,10n**BigInt(f.scale)*(10n**BigInt(t.scale)+t.n)),2);
 const purchase=round(multiply(round(price,4),ratio),4);
 return {tariff,ratio,purchase,tariffCost:decimal(multiply(purchase,tariff))};
}
export function dateISO(value){const d=parseDate(String(value));if(d===null)throw new Pending('Missing effective date / 生效日期缺失');return iso(d);}
export function uniqueScope(rows){return [...new Map(rows.filter(r=>r.part).map(r=>[key(r.part,normalizeRevision(r.revision)),{part:r.part,revision:normalizeRevision(r.revision)}])).values()];}
export function prepare({scope,current,mapping,tariffs,costRows,importCountry,year,priceIssues=[]}){
 const issues=[],candidates=[];
 const issue=(s,reason,extra={})=>issues.push({part:s.part,revision:s.revision,...extra,reason});
 const scoped=uniqueScope(scope);if(!scoped.length)throw new Error('Empty parts list / 零件清单为空');
 if(scope.some(r=>!r.part&&r.revision))throw new Error('Part number missing in scope / 清单有版本但缺少零件号');
 const blocked=new Set(priceIssues.map(x=>key(x.part,normalizeRevision(x.revision))));
 for(const s of scoped){
  const k=key(s.part,s.revision), prices=current.filter(r=>key(r.part,normalizeRevision(r.revision))===k);
  try{
   if(blocked.has(k))throw new Pending('Customer-price review has unresolved issues / 客户售价仍有待确认事项');
   if(!prices.length)throw new Pending('No selected current customer price / 未找到选中客户当前价');
   if(prices.some(r=>!['complete','completed','completed / 已完成','已完成'].includes(r.status.toLowerCase())))throw new Pending('Current customer price needs confirmation / 客户当前价待确认');
   const priceKeys=new Set(prices.map(r=>key(round(r.price,4),r.currency.toUpperCase(),r.unit.toLowerCase()==='pcs'?'ea':r.unit.toLowerCase(),dateISO(r.effective))));
   if(priceKeys.size!==1)throw new Pending('Customer prices, units or effective dates differ / 客户价格、单位或生效日期不一致');
   const price=prices[0],effective=dateISO(price.effective);
   if(price.currency.toUpperCase()!=='USD'||!['ea','pcs'].includes(price.unit.toLowerCase()))throw new Pending('Currency/unit basis needs confirmation / 币种或单位待确认');
   if(effective>`${year}-12-31`)throw new Pending('Effective date is later than expiration / 生效日期晚于年底失效日');
   const links=mapping.filter(r=>r.fg===s.part&&normalizeRevision(r.fgRev)===s.revision);
   if(!links.length)throw new Pending('No material mapping / 未找到原材料对应关系');
   const materialGroups=group(links,r=>key(r.material,normalizeRevision(r.materialRev)));
   if(materialGroups.size!==1)throw new Pending('Several BOM materials need confirmation / 多个BOM组件待确认');
   const material=links[0].material,materialRev=normalizeRevision(links[0].materialRev);
   if(!material)throw new Pending('Material part missing / 原材料零件号缺失');
   if(links.some(r=>decimal(r.quantity)!=='1'))throw new Pending('BOM quantity is not 1 / BOM用量非1或缺失，待确认');
   const qualified=links.filter(r=>['1','true','yes'].includes(r.blanket.toLowerCase())&&r.poStatus.toLowerCase()==='on order'&&r.lineStatus.toLowerCase()==='on order');
   const unique=[...group(qualified,r=>key(r.line,r.po,r.lineNo)).values()].map(rr=>{
    if(new Set(rr.map(r=>JSON.stringify(r,Object.keys(r).filter(k=>k!=='_row')))).size!==1)throw new Pending('Inconsistent purchase-line records / 同一采购行记录不一致');
    return rr[0];
   });
   if(unique.length!==1)throw new Pending(unique.length?'Several qualifying purchase lines / 多个符合条件采购行':'No qualifying purchase line / 无符合条件采购行');
   const po=unique[0];if(!po.line||!po.lineNo||!po.po||!po.supplier)throw new Pending('Purchase-line identifiers or supplier missing / 采购行标识或供应商缺失');
   if(po.currency.toUpperCase()!=='USD'||!['ea','pcs'].includes(po.unit.toLowerCase())||decimal(po.conversion)!=='1')throw new Pending('Purchase currency/unit conversion needs confirmation / 采购币种或换算待确认');
   const rateRows=tariffs.filter(r=>r.importCountry===importCountry&&(r.part===s.part||r.part===material));
   if(!rateRows.length)throw new Pending('No exact tariff part match / 无精确零件号关税匹配');
   if(new Set(rateRows.map(r=>r.exportCountry)).size!==1)throw new Pending('Several export-country routes / 多个出口国路径待确认');
   const normalizedRate=r=>r.rate==='0/0.278464'?'0.278':decimal(r.rate.startsWith('.')?'0'+r.rate:r.rate);
   if(new Set(rateRows.map(r=>normalizedRate(r))).size!==1)throw new Pending('Conflicting source tariff rates / 底表原始关税率冲突');
   const rate=rateRows[0],calc=calculate(price.price,rate.rate,rate.exportCountry);
   const costs=costRows.filter(r=>r.part===material&&normalizeRevision(r.revision)===materialRev);
   if(costs.length!==1)throw new Pending(costs.length?'Several standard-cost Operations / 标准成本多个Operation待确认':'Material/revision not in cost template / 标准成本模板未找到原材料版本');
   candidates.push({...s,material,materialRev,customer:[...new Set(prices.map(r=>r.customer))].join('; '),customerPO:[...new Set(prices.map(r=>r.po))].join('; '),price:round(price.price,4),effective,expiration:`${year}-12-31`,supplier:po.supplier,incoterms:/macao/i.test(po.supplier)?'CIP':'CIF',po:po.po,line:po.line,lineNo:po.lineNo,oldPurchase:po.oldPrice,oldMaterial:costs[0].material,oldTariff:costs[0].tariff,operation:costs[0].operation,sourceRate:rate.rate,origin:rate.exportCountry,costRow:costs[0].index,...calc});
  }catch(e){issue(s,e instanceof Pending?e.message:'Invalid or missing source value / 原始值无效或缺失: '+String(e.message));}
 }
 // A material shared by several finished parts must have one unambiguous target
 // and effective date. Never let the last row silently win.
 const ready=[];
 for(const rr of group(candidates,r=>key(r.material,r.materialRev)).values()){
  const related=mapping.filter(m=>m.material===rr[0].material&&normalizeRevision(m.materialRev)===rr[0].materialRev);
  const unresolved=related.some(m=>issues.some(i=>i.part===m.fg&&i.revision===normalizeRevision(m.fgRev)));
  if(unresolved){for(const r of rr)issue(r,'Another finished part using this material is unresolved / 共用原材料的其他成品仍待确认',{material:r.material});}
  else if(new Set(rr.map(r=>key(r.purchase,r.tariffCost,r.effective,r.po,r.line,r.incoterms))).size!==1){for(const r of rr)issue(r,'Conflicting targets for shared material / 同一原材料的维护目标冲突',{material:r.material});}
  else ready.push({...rr[0],part:[...new Set(rr.map(r=>r.part))].join('; ')});
 }
 return {ready,issues,scopeCount:scoped.length,duplicateScope:scope.length-scoped.length};
}
