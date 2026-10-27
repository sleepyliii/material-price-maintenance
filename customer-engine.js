// Browser-local price review. No network requests or external dependencies.
export const VERSION = '4.7.0';
export const GM_CUSTOMERS = ['GMNA','GM-NA 1','GMCCA','GM Canada SPO','GM Henniges','GM Henniges SPO'];
export const REPORTS=['currentPrices','priceChanges','overlaps','issues','history','gmCurrent','gmConsistency'];
const isGM=r=>GM_CUSTOMERS.includes(r.customer_code);
// Validated against the supplied Plex Spot Buy PO screenshots and their CSV keys.
const isSpotBuy=r=>r.PCN==='269388'&&r.PO_Type_Key==='2501'&&['Other','Spot Buy'].includes(r.PO_Type);
const GM_FIELDS=['Ship_To_Key','Ship_To_Code','Ship_To_Releases','Ship_To_Active'];
export const REQUIRED = ['PCN','Minth_Part_No','revision','customer_code','po_no','po_key','part_key','po_line_key','price_key','PO_Date','PO_Type_Key','PO_Type','Releases','Price','Raw_Price','unit','currency_code','effective_date','expiration_date','Component_Count','Component_Needs_Review','customer_part_no','customer_part_revision'];
export const messages = {
 currentActivityUnknown:['Shipped is missing or inconsistent; cannot apply the zero-activity current-price rule','Shipped 缺失或不一致，无法应用当前价零活动排除规则'],
 currentActivityInvalid:['Shipped is invalid; current-price activity needs confirmation','Shipped 数量无效，当前价活动状态需确认'],
 currentAllCustomersUnused:['All customer POs have zero Releases and zero Shipped; retained for confirmation','所有客户 PO 的 Releases 与 Shipped 均为 0，保留并待确认'],
 currentActivityUnresolved:['No other customer PO has confirmed activity; retain the zero-activity PO for confirmation','尚未确认其他客户 PO 有活动，保留零活动 PO 并待确认'],
 comparisonActiveNew:['Same-day inactive correction prices excluded from the new-price candidates','同日 inactive 更正记录不作为新价候选'],
 currentPrice:['One distinct Active price on the period end date','检查结束日有一个不同的 Active 有效售价'],
 currentNoPrice:['No Active price on period end, although a price existed during the period','期间内曾有有效价，但检查结束日没有有效价'],
 currentNoPeriodPrice:['No Active price in the review period; excluded','整期无 Active 有效价，已排除'],
 currentManyPrices:['Several different Active prices on this PO at period end','该 PO 在检查结束日有多个不同的 Active 有效售价'],
 currentInvalidPrice:['Current price cannot be determined from invalid status/date/amount data','状态、日期或金额无效，无法确定当前售价'],
 currentBasis:['Current currency/unit basis is missing or inconsistent','当前币种或单位缺失或不一致'],
 spotBuyExcluded:['Spot Buy excluded from price comparison','Spot Buy 已排除，不参与售价比较'],
 gmMetadata:['GM Ship-to fields are missing; re-export with the updated SQL','缺少 GM Ship-to 信息，请用新版 SQL 重新导出'],
 gmAddress:['Missing or inactive approved GM Ship-to; confirmation required','GM 批准收货地址缺失或非 Active，需要确认'],
 gmBatch:['Latest GM Blanket batch with positive Ship-to Releases; same-day POs retained','最新 GM Blanket 批次，Ship-to Releases > 0；保留同日多个 PO'],
 gmZeroBatch:['Ship-to Blanket Releases are all zero; latest GM batch retained','该 Ship-to 的 Blanket Releases 全为零，保留最新 GM 批次'],
 gmCurrent:['One distinct Active price on the period end date','检查结束日有一个不同的 Active 有效售价'],
 gmNoPrice:['No Active price effective on the period end date','检查结束日没有 Active 且在有效期内的售价'],
 gmNoPeriodPrice:['No Active price overlaps the review period; excluded from current-price comparison','整个检查期间内无 Active 有效售价，已排除当前价格比较'],
 gmAllExcluded:['All selected GM PO/Ship-to rows are excluded; no price comparison','所选 GM PO／地址明细均被排除，无需比价'],
 gmManyPrices:['Several different Active prices on this PO at period end','该 PO 在检查结束日有多个不同的 Active 有效售价'],
 gmInvalidPrice:['Current GM price cannot be determined from invalid price/status/date data','价格、状态或日期无效，无法确定 GM 当前售价'],
 gmUnselected:['This GM branch has no selected PO; group consistency is incomplete','该 GM 分支未选出 PO，组内一致性检查未完成'],
 gmEqual:['All compared GM branches/POs have the same effective price at period end','参与比较的 GM 分支及 PO 在检查结束日的有效售价相同'],
 gmMismatch:['Selected GM branches/POs have different effective prices','所选 GM 分支或 PO 的有效售价不同'],
 gmIncomplete:['Some GM branches/POs are unresolved; no common price is confirmed','部分 GM 分支或 PO 未确定，不确认共同售价'],
 gmBasis:['GM currency/unit bases differ; no conversion or common price assumed','GM 币种或单位不同，不换算、不确认共同售价'],
 comparisonExpiration:['Several previous prices shared the latest earlier effective date; selected the price expiring the day before the new price','前序最近生效日有多个售价，采用新价生效前一天失效的旧价'],
 invalidActive:['Price Active is missing or invalid; overlap checking is paused for this group. Re-export using the updated SQL','价格 Active 缺失或无效，暂停该组重叠检查；请用新版 SQL 重新导出'],
 selected:['Selected','选中'],excluded:['Excluded','排除'],review:['Needs confirmation','待确认'],paused:['Paused','暂停'],complete:['Completed','已完成'],partial:['Partial results; confirmation required','部分结果待确认'],
 eligible:['Blanket, Releases > 0 and latest PO date','Blanket、Releases > 0 且 PO 日期最新'],fallbackZero:['All Blanket Releases are zero; latest Blanket PO date selected','Blanket 的 Releases 全为零，选取最新 Blanket PO 日期'],notBlanket:['Not Blanket','不是 Blanket'],noReleases:['Zero Releases; a Blanket PO with positive Releases takes priority','Releases 为零，优先选择 Releases > 0 的 Blanket PO'],older:['A newer eligible PO exists','存在日期更新的合格 PO'],tie:['Latest eligible PO dates are tied; no automatic selection','最新合格 PO 日期并列，不自动选择'],
 missingScope:['Part / specified revision not found in export','导出中未找到指定零件及版本'],noPO:['No eligible Blanket PO','没有合格的 Blanket PO'],metadata:['Inconsistent selection fields within one PO line','同一 PO 明细的筛选字段不一致'],duplicate:['Duplicate price_key; confirmation required','price_key 重复，需要确认'],blocked:['PO selection paused because of an unresolved issue','因存在待确认事项，暂停 PO 选择'],
 unknownPCN:['Blanket mapping is not confirmed for this PCN','此 PCN 的 Blanket 类型映射尚未确认'],typeMismatch:['PO type key and label do not match','PO 类型键与标签不一致'],negativeReleases:['Negative Releases; confirmation required','Releases 为负数，需要确认'],invalidNumber:['Missing or invalid numeric value','数字缺失或无效'],badPODate:['Missing or invalid PO date','PO 日期缺失或无效'],
 missingDate:['Missing effective date; this comparison group is paused','缺少生效日期，暂停该比较组'],reverseDate:['Expiration precedes effective date; this comparison group is paused','失效日期早于生效日期，暂停该比较组'],badDate:['Invalid date or non-midnight price timestamp; confirmation required','日期无效或价格日期含非零时分秒，需要确认'],unknownUnit:['Unit has not been confirmed','单位尚未确认'],missingIdentity:['Currency or unit is missing','币种或单位缺失'],priceMismatch:['Price differs from Raw_Price; use the corrected SQL export','Price 与 Raw_Price 不一致，请使用售价修正版 SQL'],
 firstPrice:['No earlier price; cannot determine a price change','没有更早价格，无法判断是否调价'],ambiguousPrice:['Cannot uniquely determine the previous/new price pair','无法唯一确定旧价与新价'],comparison:['Compared with the most recent earlier effective-date price; overlaps are listed separately','对比更早最近生效日的售价；有效期重叠另列'],multiCustomers:['Eligible POs span multiple customers; confirmation required','合格 PO 涉及多个客户，需要确认'],
 missingHeaders:['Missing required CSV columns','CSV 缺少必需列'],malformedCSV:['Malformed CSV. Use the original Plex export','CSV 格式无效，请使用 Plex 原始导出'],emptyCSV:['The CSV contains no data','CSV 没有数据'],invalidScope:['Enter at least one part; every row must include a revision field (blank means blank revision)','请填写至少一个零件；每行需有版本字段，留空明确代表空白版本'],invalidPeriod:['Enter valid start and end dates, with start no later than end','请填写有效起止日期，开始日期不能晚于结束日期'],
};
export function message(code,details='',lang='en') { const m=messages[code]||[code,code]; return m[lang==='zh'?1:0]+(details?' · '+details:''); }
export function bilingual(code,details='') { return message(code,details,'en')+' / '+message(code,details,'zh'); }
function fail(code,details='') { throw new Error(JSON.stringify({code,details})); }
export function parseCSV(text) {
 text=text.replace(/^\uFEFF/,''); const all=[]; let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted) { if(c==='"') { if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;} }else value+=c; continue; }
  if(c==='"') { if(value||closed)fail('malformedCSV');quoted=true;continue; }
  if(c===','||c==='\n'||c==='\r') {
   row.push(value);value='';closed=false;
   if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))all.push(row);row=[];}continue;
  }
  if(closed) { if(c===' '||c==='\t')continue;fail('malformedCSV'); }
  value+=c;
 }
 if(quoted)fail('malformedCSV');
 if(value!==''||closed||row.length){row.push(value);if(row.some(x=>x!==''))all.push(row);}
 if(!all.length)fail('emptyCSV');
 const headers=all.shift().map(x=>x.trim());
 if(new Set(headers).size!==headers.length)fail('malformedCSV','Duplicate headers');
 const rows=all.map((values,index)=>{
  if(values.length!==headers.length)fail('malformedCSV','CSV row '+(index+2));
  return Object.assign(Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()])),{_line:index+2});
 });
 return {headers,rows};
}
export function decodeCSV(buffer) {
 const b=new Uint8Array(buffer);
 if(b[0]===255&&b[1]===254)return new TextDecoder('utf-16le').decode(buffer);
 if(b[0]===254&&b[1]===255)return new TextDecoder('utf-16be').decode(buffer);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{return new TextDecoder('gb18030',{fatal:true}).decode(buffer);}
}
// Exact decimal arithmetic: no binary floating-point arithmetic on prices.
export function decimal(s) {
 if(!/^[+-]?\d+(\.\d+)?$/.test(String(s)))fail('invalidNumber',String(s));
 let sign='';s=String(s);if(s[0]==='-'){sign='-';s=s.slice(1);}else if(s[0]==='+')s=s.slice(1);
 let [whole,fraction='']=s.split('.'); whole=whole.replace(/^0+(?=\d)/,'');fraction=fraction.replace(/0+$/,'');
 if(whole==='0'&&!fraction)sign='';return sign+whole+(fraction?'.'+fraction:'');
}
// Price-only decimal rounding: half-up to four places, using integers (including negative ties).
export function price4(value){
 const valueText=decimal(value),negative=valueText.startsWith('-'),absolute=negative?valueText.slice(1):valueText;
 const [whole,fraction='']=absolute.split('.');
 let scaled=BigInt(whole)*10000n+BigInt((fraction+'0000').slice(0,4));
 if(fraction.length>4&&fraction[4]>='5')scaled+=1n;
 const digits=scaled.toString().padStart(5,'0');
 return decimal((negative?'-':'')+digits.slice(0,-4)+'.'+digits.slice(-4));
}
export function formatPrice(value){const text=price4(value),[whole,fraction='']=text.split('.');return whole+'.'+fraction.padEnd(4,'0');}
const priceIdentity=value=>{try{return price4(value);}catch{return String(value??'');}};
function integerParts(s) {s=decimal(s);const scale=(s.split('.')[1]||'').length;return {n:BigInt(s.replace('.','')),scale};}
export function compare(a,b) {const x=integerParts(a),y=integerParts(b),n=Math.max(x.scale,y.scale);const z=x.n*10n**BigInt(n-x.scale)-y.n*10n**BigInt(n-y.scale);return z<0n?-1:z>0n?1:0;}
export function subtract(a,b) { const x=integerParts(a),y=integerParts(b),scale=Math.max(x.scale,y.scale);let n=x.n*10n**BigInt(scale-x.scale)-y.n*10n**BigInt(scale-y.scale);const negative=n<0n;if(negative)n=-n;let s=n.toString().padStart(scale+1,'0');if(scale)s=s.slice(0,-scale)+'.'+s.slice(-scale);return decimal((negative?'-':'')+s); }
export function parseDate(value,po=false) {
 if(!value)return null;
 let m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),y,mo,d;
 if(m){[,y,mo,d]=m.map(Number);}else{
  m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?: (\d{1,2}):(\d{2}):(\d{2}) (AM|PM))?$/);
  if(!m)fail(po?'badPODate':'badDate',value);
  mo=+m[1];d=+m[2];y=+m[3];if(y<100)y+=y<69?2000:1900;
  if(m[4]&&(+m[4]<1||+m[4]>12||+m[5]>59||+m[6]>59))fail(po?'badPODate':'badDate',value);
  if(!po&&m[4]&&!(m[4]==='12'&&m[5]==='00'&&m[6]==='00'&&m[7]==='AM'))fail('badDate',value);
 }
 const dt=new Date(Date.UTC(y,mo-1,d));
 if(y<1000||y>9998||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)fail(po?'badPODate':'badDate',value);
 return Math.floor(dt.getTime()/86400000);
}
export const iso=d=>new Date(d*86400000).toISOString().slice(0,10);
const key=(...x)=>JSON.stringify(x);
const groupBy=(rows,fn)=>{const map=new Map();for(const r of rows){const k=fn(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r);}return map;};
const canonicalUnit=u=>u==='pcs'||u==='Ea'?'Ea':u;
export function normalizeRevision(value){const revision=String(value??'').trim();return /^\d$/.test(revision)?'0'+revision:revision;}
function context(r){return {part:r.Minth_Part_No||'',revision:normalizeRevision(r.revision),pcn:r.PCN||'',partKey:r.part_key||'',customer:r.customer_code||'',po:r.po_no||'',poKey:r.po_key||'',lineKey:r.po_line_key||'',currency:r.currency_code||'',unit:canonicalUnit(r.unit||''),shipToKey:isGM(r)?r.Ship_To_Key||'':'',shipTo:isGM(r)?r.Ship_To_Code||'':''};}
const selectionKey=r=>key(r.PCN,r.part_key,r.customer_code,isGM(r)?r.Ship_To_Key||'':'');
const poBranchKey=r=>key(selectionKey(r),r.po_line_key);
const groupKey=r=>key(...Object.values(context(r)));
const sortedPrices=x=>[...x].sort(compare);
function errorInfo(e){try{return JSON.parse(e.message);}catch{return {code:'invalidNumber',details:String(e.message)};}}
export function overlapping(records,start,end){
 const events=new Map();const boundaries=new Set([start,end+1]);
 const event=(day,price,delta)=>{if(!events.has(day))events.set(day,new Map());const m=events.get(day);m.set(price,(m.get(price)||0)+delta);};
 for(const r of records){const a=Math.max(start,r.start),b=Math.min(end,r.end??end);if(a>b)continue;const price=price4(r.price);boundaries.add(a);boundaries.add(b+1);event(a,price,1);event(b+1,price,-1);}
 const days=[...boundaries].sort((a,b)=>a-b),active=new Map(),out=[];
 for(let i=0;i<days.length-1;i++){const day=days[i];for(const [p,n]of events.get(day)||[])active.set(p,(active.get(p)||0)+n);const prices=sortedPrices([...active].filter(([,n])=>n>0).map(([p])=>p));if(prices.length<2)continue;const last=out.at(-1);if(last&&last.end+1===day&&key(last.prices)===key(prices))last.end=days[i+1]-1;else out.push({start:day,end:days[i+1]-1,prices});}
 return out;
}
function resolveCurrentPrice(rr,periodStart,asOf,issue){
   const first=rr[0],row={...context(first),asOf:iso(asOf),price:'',priceKeys:'',status:'review',reason:''};
   try{
    const effective=[];let activeDuringPeriod=false;
    for(const r of rr){
     if(!['0','1'].includes(r.Price_Active))fail('gmInvalidPrice');
     if(r.Price_Active==='0')continue;
     let a,b;try{a=parseDate(r.effective_date);b=parseDate(r.expiration_date);}catch{fail('gmInvalidPrice');}
     if(a===null||(b!==null&&b<a))fail('gmInvalidPrice');
     if(a<=asOf&&(b===null||b>=periodStart))activeDuringPeriod=true;
     if(a>asOf||(b!==null&&b<asOf))continue;
     if(!r.currency_code||!['pcs','Ea'].includes(r.unit))fail('gmBasis');
     const price=price4(r.Price);if(compare(price,price4(r.Raw_Price))!==0)fail('gmInvalidPrice');
     effective.push({price,currency:r.currency_code,unit:canonicalUnit(r.unit),priceKey:r.price_key,effective:iso(a),expiration:b===null?'':iso(b)});
    }
    if(!effective.length){if(activeDuringPeriod)fail('gmNoPrice','An Active price existed during the period / 期间内曾有有效价');else fail('gmNoPeriodPrice',iso(periodStart)+' — '+iso(asOf));}
    if(new Set(effective.map(r=>key(r.currency,r.unit))).size!==1)fail('gmBasis');
    const amounts=sortedPrices(new Set(effective.map(r=>r.price)));
    if(amounts.length!==1)fail('gmManyPrices',amounts.map(formatPrice).join('; '));
    Object.assign(row,{price:amounts[0],currency:effective[0].currency,unit:effective[0].unit,effective:[...new Set(effective.map(r=>r.effective))].sort().join('; '),priceKeys:[...new Set(effective.map(r=>r.priceKey))].join('; '),status:'complete',reason:'gmCurrent'});
   }catch(e){const info=errorInfo(e);row.reason=['gmNoPrice','gmNoPeriodPrice','gmManyPrices','gmBasis'].includes(info.code)?info.code:'gmInvalidPrice';row.details=info.code==='gmNoPeriodPrice'?info.details:iso(asOf)+(info.details?' · '+info.details:'');if(info.code==='gmNoPeriodPrice')row.status='excluded';else issue(first,row.reason,row.details);}
   return row;
}
function buildGMReports(report,matched,selected,periodStart,asOf,issue){
 const gmRows=matched.filter(r=>isGM(r)&&!isSpotBuy(r)),selectedByBranch=groupBy(selected.filter(isGM),selectionKey);
 for(const [branch,source]of groupBy(gmRows,selectionKey)){
  const chosen=selectedByBranch.get(branch)||[];
  if(!chosen.length){report.gmCurrent.push({...context(source[0]),po:'',poKey:'',lineKey:'',asOf:iso(asOf),price:'',priceKeys:'',status:'review',reason:'gmUnselected'});continue;}
  for(const rr of groupBy(chosen,poBranchKey).values()){
   report.gmCurrent.push(resolveCurrentPrice(rr,periodStart,asOf,issue));
  }
 }
 for(const rr of groupBy(report.gmCurrent,r=>key(r.pcn,r.part,r.revision)).values()){
  const first=rr[0],participating=rr.filter(r=>r.status!=='excluded'),valid=participating.filter(r=>r.status==='complete'),unresolved=participating.some(r=>r.status!=='complete');
  const bases=new Set(valid.map(r=>key(r.currency,r.unit))),oneBasis=bases.size===1;
  const prices=oneBasis?sortedPrices(new Set(valid.map(r=>r.price))):[];
  let reason=!participating.length?'gmAllExcluded':bases.size>1?'gmBasis':prices.length>1?'gmMismatch':unresolved||!valid.length?'gmIncomplete':'gmEqual';
  const details=rr.map(r=>[r.customer,r.shipTo||'?',r.po||'?',r.status==='complete'?formatPrice(r.price)+' '+r.currency+'/'+r.unit:bilingual(r.reason)].join(' · ')).join(' | ');
  report.gmConsistency.push({part:first.part,revision:first.revision,pcn:first.pcn,asOf:iso(asOf),commonPrice:reason==='gmEqual'?prices[0]:'',currency:oneBasis?valid[0].currency:'',unit:oneBasis?valid[0].unit:'',distinctCount:oneBasis?prices.length:'',prices:prices.join('; '),difference:oneBasis&&prices.length?subtract(prices.at(-1),prices[0]):'',branchCount:new Set(participating.map(r=>key(r.customer,r.shipToKey))).size,poCount:participating.filter(r=>r.po).length,status:reason==='gmEqual'?'complete':reason==='gmAllExcluded'?'excluded':reason==='gmIncomplete'?'partial':'review',reason,gmMembers:details});
  if(['gmMismatch','gmBasis'].includes(reason)){
   const source=gmRows.find(r=>r.PCN===first.pcn&&r.Minth_Part_No===first.part&&normalizeRevision(r.revision)===first.revision);
   issue({...source,customer_code:'GM group',po_no:'',po_key:'',po_line_key:'',price_key:'',currency_code:oneBasis?valid[0].currency:'',unit:oneBasis?valid[0].unit:''},reason,iso(asOf)+' · '+details);
  }
 }
}
function currentActivityPlan(selected){
 const excluded=new Set(),review=new Map(),pending=[];
 const identity=r=>key(r.PCN,r.po_line_key);
 for(const rr of groupBy(selected,r=>key(r.PCN,r.Minth_Part_No,normalizeRevision(r.revision))).values()){
  if(new Set(rr.map(r=>r.customer_code)).size<2)continue;
  const lines=[];
  for(const source of groupBy(rr,identity).values()){
   const first=source[0],id=identity(first);let state='unknown',code='';
   try{
    const releases=decimal(first.Releases);
    if(compare(releases,'0')>0)state='used';
    else{
     const shippedValues=new Set(source.map(r=>r.Shipped));
     if(shippedValues.size!==1||first.Shipped===undefined||String(first.Shipped).trim()===''||String(first.Shipped).toUpperCase()==='NULL')code='currentActivityUnknown';
     else{const shipped=decimal(first.Shipped);if(compare(shipped,'0')<0)code='currentActivityInvalid';else state=compare(shipped,'0')===0?'zero':'used';}
    }
   }catch{code='currentActivityInvalid';}
   lines.push({first,id,state,code});
  }
  const hasActivity=lines.some(r=>r.state==='used'),allZero=lines.every(r=>r.state==='zero');
  for(const line of lines){
   if(line.state==='zero'&&hasActivity){excluded.add(line.id);continue;}
   const code=line.code||(line.state==='zero'?(allZero?'currentAllCustomersUnused':'currentActivityUnresolved'):'');
   if(code){review.set(line.id,code);pending.push({source:line.first,code,details:''});}
  }
 }
 return {excluded,review,pending,identity};
}
function buildCurrentPrices(report,selected,periodStart,asOf){
 const activity=currentActivityPlan(selected);
 const markActivity=(row,source)=>{const code=activity.review.get(activity.identity(source));return code?{...row,status:'review',reason:code}:row;};
 const codes={gmCurrent:'currentPrice',gmNoPrice:'currentNoPrice',gmNoPeriodPrice:'currentNoPeriodPrice',gmManyPrices:'currentManyPrices',gmInvalidPrice:'currentInvalidPrice',gmBasis:'currentBasis'};
 const gmRows=report.gmCurrent.filter(r=>r.po&&r.status!=='excluded'&&!activity.excluded.has(key(r.pcn,r.lineKey))).map(row=>markActivity(row,{PCN:row.pcn,po_line_key:row.lineKey}));
 for(const rr of groupBy(gmRows,r=>key(r.pcn,r.partKey,r.part,r.revision,r.customer)).values()){
  const samePrice=rr.every(r=>r.status==='complete')&&new Set(rr.map(r=>key(r.price,r.currency,r.unit))).size===1;
  for(const group of groupBy(rr,r=>r.status==='complete'?key(r.price,r.currency,r.unit):key('unresolved',r.lineKey,r.shipToKey,r.reason)).values()){
   const unique=field=>[...new Set(group.flatMap(r=>String(r[field]||'').split('; ').filter(Boolean)))].join('; ');
   const row={...group[0],shipTo:samePrice?'':unique('shipTo'),shipToKey:unique('shipToKey'),sourceShipTos:unique('shipTo'),po:unique('po'),poKey:unique('poKey'),lineKey:unique('lineKey'),effective:unique('effective'),priceKeys:unique('priceKeys'),reason:codes[group[0].reason]||group[0].reason};
   report.currentPrices.push(row);
  }
 }
 const pending=[];
 for(const rr of groupBy(selected.filter(r=>!isGM(r)&&!activity.excluded.has(activity.identity(r))),poBranchKey).values()){
  const row=resolveCurrentPrice(rr,periodStart,asOf,(source,code,details)=>pending.push({source,code:codes[code]||'currentInvalidPrice',details}));
  row.reason=codes[row.reason]||'currentInvalidPrice';
  if(row.status!=='excluded')report.currentPrices.push(markActivity(row,rr[0]));
 }
 const visible=new Set(report.currentPrices.flatMap(r=>String(r.lineKey||'').split('; ').map(lineKey=>key(r.pcn,lineKey))));
 return [...pending,...activity.pending.filter(p=>visible.has(activity.identity(p.source)))];
}
export function analyze(rows,headers,scope,startText,endText,sourceName='') {
 const missing=REQUIRED.filter(x=>!headers.includes(x));if(missing.length)fail('missingHeaders',missing.join(', '));
 let start,end;try{start=parseDate(startText);end=parseDate(endText);}catch{fail('invalidPeriod');}
 if(start===null||end===null||start>end)fail('invalidPeriod');
 if(!scope.length||scope.some(s=>!s.PartNo||!Object.hasOwn(s,'Revision')))fail('invalidScope');
 scope=[...new Map(scope.map(s=>[key(s.PartNo.trim(),normalizeRevision(s.Revision)),{PartNo:s.PartNo.trim(),Revision:normalizeRevision(s.Revision)}])).values()];
 const scopeSet=new Set(scope.map(s=>key(s.PartNo,s.Revision)));
 const matched=rows.filter(r=>scopeSet.has(key(r.Minth_Part_No,normalizeRevision(r.revision))));
 const report={poSelection:[],priceChanges:[],overlaps:[],coverage:[],issues:[],history:[],gmCurrent:[],gmConsistency:[],currentPrices:[]};
 const issue=(r,code,details='')=>report.issues.push({...context(r),priceKey:r.price_key||'',sourceRow:r._line||'',code,details});
 for(const s of scope)if(!matched.some(r=>r.Minth_Part_No===s.PartNo&&normalizeRevision(r.revision)===s.Revision))issue({Minth_Part_No:s.PartNo,revision:s.Revision},'missingScope');
 const blocked=new Set();
 const comparable=matched.filter(r=>!isSpotBuy(r));
 for(const rr of groupBy(comparable,r=>key(r.PCN,r.price_key,isGM(r)?r.Ship_To_Key||'':'')).values())if(rr.length>1)for(const r of rr){blocked.add(selectionKey(r));issue(r,'duplicate');}
 // A shared GM price_key may repeat across addresses, but its source price must agree.
 for(const rr of groupBy(comparable,r=>key(r.PCN,r.price_key)).values())if(rr.some(isGM)&&['part_key','Minth_Part_No','revision','po_key','po_line_key','PO_Date','PO_Type_Key','PO_Type','Releases','customer_code','Price','Raw_Price','Price_Active','effective_date','expiration_date','unit','currency_code','customer_part_no','customer_part_revision'].some(f=>new Set(rr.map(r=>['Price','Raw_Price'].includes(f)?priceIdentity(r[f]):r[f])).size>1))for(const r of rr){blocked.add(selectionKey(r));issue(r,'metadata');}
 const selected=[];
 for(const [pk,pr]of groupBy(matched,selectionKey)){
  const candidates=[];let block=blocked.has(pk);
  for(const rr of groupBy(pr,r=>r.po_line_key).values()){
   const r=rr[0],gm=isGM(r),item={...context(r),poDate:r.PO_Date,type:r.PO_Type,releases:gm?r.Ship_To_Releases:r.Releases,status:'excluded',reason:'',details:''};report.poSelection.push(item);
   if(rr.every(isSpotBuy)){
    item.type='Spot Buy';item.reason='spotBuyExcluded';
    report.coverage.push({...context(r),status:'excluded',reason:'spotBuyExcluded',rawRows:rr.length,intervals:0,changeCount:'',overlapCount:''});
    continue;
   }
   const meta=['po_key','PO_Date','PO_Type_Key','PO_Type','Releases','customer_code','Minth_Part_No','revision',...(gm?GM_FIELDS:[])];
   if(meta.some(f=>new Set(rr.map(x=>f==='revision'?normalizeRevision(x[f]):x[f])).size>1)){issue(r,'metadata');block=true;item.status='review';item.reason='metadata';continue;}
   try{
    if(gm&&GM_FIELDS.some(f=>!headers.includes(f)))fail('gmMetadata');
    if(gm&&(!r.Ship_To_Key||!r.Ship_To_Code||r.Ship_To_Active!=='1'))fail('gmAddress');
    const rel=decimal(gm?r.Ship_To_Releases:r.Releases);if(compare(rel,'0')<0)fail('negativeReleases');
    if(r.PCN!=='269388')fail('unknownPCN',r.PCN);
    if(r.PO_Type!==(r.PO_Type_Key==='2500'?'Blanket':r.PO_Type_Key==='2501'?'Spot Buy':'Other')&&!isSpotBuy(r))fail('typeMismatch');
    if(r.PO_Type!=='Blanket'){item.reason='notBlanket';continue;}
    candidates.push({rel,item,rr});
   }catch(e){const x=errorInfo(e);issue(r,x.code,x.details);block=true;item.status='review';item.reason=x.code;item.details=x.details||'';}
  }
  const hasPositive=candidates.some(x=>compare(x.rel,'0')>0);
  const pool=candidates.filter(x=>!hasPositive||compare(x.rel,'0')>0);
  for(const x of candidates)if(!pool.includes(x))x.item.reason='noReleases';
  for(const x of pool){try{const day=parseDate(x.rr[0].PO_Date,true);if(day===null)fail('badPODate');x.day=day;x.item.poDate=iso(day);}catch(e){const info=errorInfo(e);issue(x.rr[0],info.code,info.details);block=true;x.item.status='review';x.item.reason=info.code;x.item.details=info.details||'';}}
  if(block){for(const x of pool){if(x.item.status!=='review'){x.item.status='paused';x.item.reason='blocked';}}}
  else if(!pool.length&&!pr.every(isSpotBuy))issue(pr[0],'noPO');
  else if(!pool.length)continue;
  else{
   const latest=Math.max(...pool.map(x=>x.day)),winners=pool.filter(x=>x.day===latest);
   for(const x of pool){if(x.day<latest)x.item.reason='older';else if(winners.length>1&&!isGM(pr[0])){x.item.status='review';x.item.reason='tie';}else{x.item.status='selected';x.item.reason=isGM(pr[0])?(hasPositive?'gmBatch':'gmZeroBatch'):(hasPositive?'eligible':'fallbackZero');selected.push(...x.rr);}}
   if(winners.length>1&&!isGM(pr[0]))issue(pr[0],'tie');
  }
 }
 const blockedDates=new Set();
 for(const r of selected){try{const a=parseDate(r.effective_date),b=parseDate(r.expiration_date);if(a===null||(b!==null&&b<a))blockedDates.add(groupKey(r));}catch{blockedDates.add(groupKey(r));}}
 for(const rr of groupBy(selected,r=>key(groupKey(r),r.customer_part_no,r.customer_part_revision)).values()){
  const first=rr[0],base=context(first);let invalid=blockedDates.has(groupKey(first)),activeInvalid=false;const dedup=new Map(),activeDedup=new Map();
  for(const r of rr){
   report.history.push({...context(r),customerPart:r.customer_part_no,customerRevision:r.customer_part_revision,priceKey:r.price_key,price:priceIdentity(r.Price),sourcePrice:r.Price,sourceRawPrice:r.Raw_Price,priceActive:r.Price_Active??'',originalUnit:r.unit,effective:r.effective_date,expiration:r.expiration_date,componentCount:r.Component_Count,componentReview:r.Component_Needs_Review,sourceRow:r._line});
   if(!['0','1'].includes(r.Price_Active)){activeInvalid=true;issue(r,'invalidActive');}
   try{
    if(!r.currency_code||!r.unit)fail('missingIdentity');if(!['pcs','Ea'].includes(r.unit))fail('unknownUnit',r.unit);
    const price=price4(r.Price);if(compare(price,price4(r.Raw_Price))!==0)fail('priceMismatch');
    const a=parseDate(r.effective_date),b=parseDate(r.expiration_date);if(a===null)fail('missingDate');if(b!==null&&b<a)fail('reverseDate');const record={price,start:a,end:b};dedup.set(key(price,a,b),record);if(r.Price_Active==='1')activeDedup.set(key(price,a,b),record);
   }catch(e){invalid=true;const x=errorInfo(e);issue(r,x.code,x.details);}
  }
  const rec=[...dedup.values()],coverage={...base,status:invalid?'paused':'complete',rawRows:rr.length,intervals:rec.length,changeCount:'',overlapCount:''};
  if(!invalid){
   const batches=groupBy(rec,r=>r.start),activeBatches=groupBy([...activeDedup.values()],r=>r.start);let previous=null,previousRecords=[],previousDay=null,pending=false;const oldChanges=report.priceChanges.length,oldOverlaps=report.overlaps.length;
   for(const day of [...batches.keys()].sort((a,b)=>a-b)){
    const prices=sortedPrices(new Set(batches.get(day).map(r=>r.price)));
    const activePrices=sortedPrices(new Set((activeBatches.get(day)||[]).map(r=>r.price)));
    // Current Active identifies same-day corrections, while prior inactive history remains available.
    const newPrices=!activeInvalid&&prices.length>1&&activePrices.length?activePrices:prices;
    if(day>=start&&day<=end&&(previous===null||key(previous)!==key(newPrices))){
     if(previous===null){issue(first,'firstPrice',iso(day));pending=true;}
     else{
      let oldPrices=previous,note='comparison';
      if(previous.length>1){const expiring=sortedPrices(new Set(previousRecords.filter(r=>r.end===day-1).map(r=>r.price)));if(expiring.length===1){oldPrices=expiring;note='comparisonExpiration';}}
      if(newPrices.length<prices.length)note+='|comparisonActiveNew';
      if(oldPrices.length!==1||newPrices.length!==1){issue(first,'ambiguousPrice','New effective date / 新价生效日: '+iso(day)+'; Previous effective date / 前序生效日: '+iso(previousDay)+'; Previous prices / 前序售价: '+previous.map(formatPrice).join('; ')+'; New prices / 新售价: '+newPrices.map(formatPrice).join('; '));pending=true;}
      else if(compare(oldPrices[0],newPrices[0])!==0)report.priceChanges.push({...base,effective:iso(day),oldPrice:oldPrices[0],newPrice:newPrices[0],difference:subtract(newPrices[0],oldPrices[0]),note});
     }
    }
    previous=prices;previousRecords=batches.get(day);previousDay=day;
   }
   if(!activeInvalid)for(const s of overlapping([...activeDedup.values()],start,end))report.overlaps.push({...base,start:iso(s.start),end:iso(s.end),distinctCount:s.prices.length,prices:s.prices.join('; ')});
   coverage.changeCount=report.priceChanges.length-oldChanges;coverage.overlapCount=activeInvalid?'':report.overlaps.length-oldOverlaps;if(pending||activeInvalid)coverage.status='partial';
  }
  report.coverage.push(coverage);
 }
 buildGMReports(report,matched,selected,start,end,issue);
 const currentPending=buildCurrentPrices(report,selected,start,end);
 for(const {source,code,details} of currentPending){
  const ctx=context(source),equivalent=code==='currentInvalidPrice'?['invalidActive','missingDate','reverseDate','badDate','invalidNumber','priceMismatch']:code==='currentBasis'?['unknownUnit','missingIdentity']:[];
  const alreadyReported=report.issues.some(r=>['pcn','partKey','customer','poKey','lineKey'].every(k=>r[k]===ctx[k])&&(r.code===code||equivalent.includes(r.code)));
  if(!alreadyReported)issue(source,code,details);
 }
 report.summary={version:VERSION,priceDecimals:4,priceRounding:'half_up',source:sourceName,start:startText,end:endText,scope,sourceRows:rows.length,matchedRows:matched.length,selectedRows:selected.length,selectedLines:report.poSelection.filter(r=>r.status==='selected').length,changes:report.priceChanges.length,overlaps:report.overlaps.length,issues:report.issues.length,gmAsOf:iso(end),gmGroups:report.gmConsistency.length,currentPOs:report.currentPrices.length};
 return report;
}
export const COLUMNS={part:['Part No.','零件号'],revision:['Revision','版本'],pcn:['PCN','PCN'],partKey:['Part key','零件键'],customer:['Customer','客户'],po:['PO','PO'],poKey:['PO key','PO键'],lineKey:['PO line key','PO明细键'],currency:['Currency','币种'],unit:['Comparison unit','比较单位'],poDate:['PO date','PO日期'],type:['PO type','PO类型'],releases:['Releases','Releases数量'],status:['Status','状态'],reason:['Reason','原因'],effective:['Effective date','生效日'],oldPrice:['Previous price','前序价格'],newPrice:['New price','新价格'],difference:['Difference','差额'],note:['Note','说明'],start:['Start date','开始日期'],end:['End date','结束日期'],distinctCount:['Distinct prices','不同售价数量'],prices:['Prices','售价列表'],rawRows:['Source price rows','原始价格行数'],intervals:['Analysis intervals','分析区间数'],changeCount:['Changes','调价事件数'],overlapCount:['Overlap intervals','重叠区间数'],priceKey:['Price key','价格键'],sourceRow:['CSV row','CSV行号'],code:['Issue','问题'],customerPart:['Customer part No.','客户零件号'],customerRevision:['Customer revision','客户版本'],price:['Price','售价'],originalUnit:['Original unit','原始单位'],expiration:['Expiration date','失效日'],componentCount:['Component count','组件数量'],componentReview:['Component review flag','组件核对标记'],priceActive:['Price Active (current)','价格Active（当前）']};
const BASE=['part','revision','customer','po','currency','unit','pcn','partKey','poKey','lineKey'];
const TRACE=['pcn','partKey','poKey','lineKey'];
export const SCHEMAS={poSelection:['part','revision','customer','po','poDate','type','releases','status','reason',...TRACE],priceChanges:['part','revision','customer','po','effective','oldPrice','newPrice','difference','currency','unit','note',...TRACE],overlaps:['part','revision','customer','po','start','end','distinctCount','prices','currency','unit',...TRACE],coverage:['part','revision','customer','po','status','rawRows','intervals','changeCount','overlapCount','currency','unit',...TRACE],issues:['part','revision','customer','po','code','priceKey','sourceRow','currency','unit',...TRACE],history:['part','revision','customer','po','price','priceActive','effective','expiration','currency','originalUnit','customerPart','customerRevision','priceKey','sourceRow','unit','componentCount','componentReview',...TRACE]};
Object.assign(COLUMNS,{shipTo:['Ship-to','收货地址'],shipToKey:['Ship-to key','收货地址键'],asOf:['As-of date','基准日'],priceKeys:['Current price keys','当前价格键'],commonPrice:['Common effective price','共同有效售价'],branchCount:['Compared customer/Ship-to branches','参与客户／地址分支数'],poCount:['Compared PO lines/Ship-tos','参与PO明细／地址数'],gmMembers:['Branch / PO price details','分支／PO售价明细']});
Object.assign(COLUMNS,{sourcePrice:['Original source Price','原始Price'],sourceRawPrice:['Original source Raw_Price','原始Raw_Price']});
SCHEMAS.history.push('sourcePrice','sourceRawPrice');
SCHEMAS.coverage.splice(SCHEMAS.coverage.indexOf('status')+1,0,'reason');
for(const name of Object.keys(SCHEMAS)){const at=SCHEMAS[name].indexOf('customer');if(at>=0)SCHEMAS[name].splice(at+1,0,'shipTo','shipToKey');}
SCHEMAS.gmCurrent=['part','revision','customer','shipTo','po','asOf','price','currency','unit','status','reason','priceKeys','shipToKey',...TRACE];
SCHEMAS.gmConsistency=['part','revision','asOf','commonPrice','currency','unit','status','reason','distinctCount','prices','difference','branchCount','poCount','gmMembers','pcn'];
SCHEMAS.currentPrices=['part','revision','customer','shipTo','po','asOf','price','effective','currency','unit','status','reason','priceKeys','shipToKey',...TRACE];
 COLUMNS.sourceShipTos=['Source Ship-tos','来源收货地址'];SCHEMAS.currentPrices.push('sourceShipTos');
export function cell(row,field,lang='en',both=false){
 const v=row[field]??'';
 if(v!==''&&['price','oldPrice','newPrice','commonPrice','difference'].includes(field)){try{return formatPrice(v);}catch{return v;}}
 if(field==='prices'&&v){try{return String(v).split('; ').map(formatPrice).join('; ');}catch{return v;}}
 if(['status','reason','note','code'].includes(field)&&v){return String(v).split('|').map(c=>both?bilingual(c,row.details||''):message(c,row.details||'',lang)).join('; ');}
 return v;
}
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
export function toCSV(report,name){
 const columns=SCHEMAS[name];const safe=v=>typeof v==='string'&&/^[=+@]/.test(v)?"'"+v:v;
 return '\uFEFF'+[columns.map(k=>quote(COLUMNS[k][0]+' / '+COLUMNS[k][1])).join(','),...report[name].map(r=>columns.map(k=>quote(safe(cell(r,k,'en',true)))).join(','))].join('\r\n')+'\r\n';
}






