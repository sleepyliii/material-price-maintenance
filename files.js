import {read,utils,write} from './xlsx.mjs';
import {decodeCSV} from './customer-engine.js';
export {read,utils};
export function csvRecords(text){
 const result=[];let begin=text.charCodeAt(0)===0xfeff?1:0,quoted=false;
 for(let i=begin;i<text.length;i++){
  if(text[i]==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}
  else if(!quoted&&(text[i]==='\r'||text[i]==='\n')){let end=i+1;if(text[i]==='\r'&&text[i+1]==='\n'){end++;i++;}result.push(text.slice(begin,end));begin=end;}
 }
 if(quoted)throw new Error('Unclosed CSV quote / CSV引号未闭合');
 if(begin<text.length)result.push(text.slice(begin));return result;
}
export function rawCells(record){const ending=record.endsWith('\r\n')?'\r\n':/[\r\n]$/.test(record)?record.slice(-1):'';const body=ending?record.slice(0,-ending.length):record;const fields=[];let begin=0,quoted=false;for(let i=0;i<body.length;i++){if(body[i]==='"'){if(quoted&&body[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(body[i]===','&&!quoted){fields.push(body.slice(begin,i));begin=i+1;}}fields.push(body.slice(begin));return {fields,ending};}
const unquote=s=>s.startsWith('"')?s.slice(1,-1).replace(/""/g,'"'):s;
export function csvMatrix(text){return csvRecords(text).map(r=>rawCells(r).fields.map(unquote));}
export async function openFile(file){
 const buffer=await file.arrayBuffer(),ext=file.name.toLowerCase().split('.').pop();
 if(ext==='csv'){const text=decodeCSV(buffer);return {name:file.name,buffer,text,sheets:['CSV'],matrices:{CSV:csvMatrix(text)}};}
 if(!['xlsx','xls'].includes(ext))throw new Error('Use .xlsx, .xls or .csv / 请使用Excel或CSV文件');
 const book=read(buffer,{type:'array',cellText:true,cellDates:true,cellNF:true,bookVBA:false});
 const matrices=Object.fromEntries(book.SheetNames.map(n=>{const sheet=book.Sheets[n],range=utils.decode_range(sheet['!ref']||'A1');range.s={r:0,c:0};return [n,utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:true,range})];}));
 const numeric={};
 for(const name of book.SheetNames){numeric[name]={};for(const [ref,cell]of Object.entries(book.Sheets[name])){if(ref.startsWith('!'))continue;const p=utils.decode_cell(ref);if(cell.t==='d'){const d=cell.v;matrices[name][p.r][p.c]=[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');}else if(cell.t==='n')numeric[name][ref]=String(cell.v);}}
 return {name:file.name,buffer,book,sheets:book.SheetNames,matrices,numeric};
}
export function exportCostCSV(source,ready){
 if(!source.text)throw new Error('Standard-cost template must be the original CSV / 标准成本模板须使用原CSV');
 const records=csvRecords(source.text),headers=rawCells(records[0]).fields.map(unquote);
 const m=headers.indexOf('Material.Material'),t=headers.indexOf('Material.Tariff');
 if(m<0||t<0)throw new Error('Cost columns missing / 成本字段缺失');
 const output=[records[0]];
 for(const r of ready){const raw=records[r.costRow];if(raw===undefined)throw new Error('Cost row not found');const {fields,ending}=rawCells(raw);for(const [i,v]of [[m,r.purchase],[t,r.tariffCost]])fields[i]=fields[i].startsWith('"')?'"'+v+'"':v;output.push(fields.join(',')+ending);}
 const bytes=new Uint8Array(source.buffer);
 const text=(source.text.startsWith('\ufeff')||(bytes[0]===239&&bytes[1]===187&&bytes[2]===191)?'\ufeff':'')+output.join('');
 if(bytes[0]===255&&bytes[1]===254){const b=new Uint8Array(2+text.replace(/^\ufeff/,'').length*2);b.set([255,254]);const v=new DataView(b.buffer);[...text.replace(/^\ufeff/,'')].forEach((c,i)=>v.setUint16(2+i*2,c.charCodeAt(0),true));return new Blob([b],{type:'text/csv'});}
 // Prevent any implicit encoding conversion in a Plex maintenance upload.
 new TextDecoder('utf-8',{fatal:true}).decode(source.buffer);
 return new Blob([text],{type:'text/csv;charset=utf-8'});
}
const enc=new TextEncoder(),dec=new TextDecoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
export function zipBytes(files){files=Array.from(files);const body=[],central=[];let offset=0,size=0;for(const [filename,data]of files){const name=enc.encode(filename),check=crc(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,check,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);body.push(h,data);const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,check,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);size+=c.length;offset+=h.length+data.length;}const e=new Uint8Array(22),v=new DataView(e.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...body,...central,e]);}
export async function unzip(buffer){
 const bytes=new Uint8Array(buffer),v=new DataView(buffer);let end=bytes.length-22;
 while(end>=Math.max(0,bytes.length-65557)&&v.getUint32(end,true)!==0x06054b50)end--;
 if(end<0)throw new Error('Invalid XLSX archive');const count=v.getUint16(end+10,true);let offset=v.getUint32(end+16,true);const files=new Map();let total=0;
 for(let n=0;n<count;n++){
  if(v.getUint32(offset,true)!==0x02014b50)throw new Error('Invalid ZIP entry');
  const method=v.getUint16(offset+10,true),size=v.getUint32(offset+20,true),uncompressed=v.getUint32(offset+24,true),nameLength=v.getUint16(offset+28,true),extra=v.getUint16(offset+30,true),comment=v.getUint16(offset+32,true),local=v.getUint32(offset+42,true),name=dec.decode(bytes.slice(offset+46,offset+46+nameLength));
  total+=uncompressed;if(total>100*1024*1024)throw new Error('Template is too large / 模板解压后过大');
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),compressed=bytes.slice(start,start+size);
  const data=method===0?compressed:method===8?new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()):null;
  if(!data||data.length!==uncompressed||crc(data)!==v.getUint32(offset+16,true))throw new Error('Unsupported or damaged XLSX');
  files.set(name,data);offset+=46+nameLength+extra+comment;
 }return files;
}
const XML='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml=s=>{const doc=new DOMParser().parseFromString(s,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Invalid XML');return doc;};
const elements=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
export async function exportPurchase(source,sheetName,columns,firstDataRow,ready){
 if(!source.name.toLowerCase().endsWith('.xlsx'))throw new Error('Purchase template must be .xlsx / 采购模板须为xlsx');
 const files=await unzip(source.buffer),book=xml(dec.decode(files.get('xl/workbook.xml'))),rels=xml(dec.decode(files.get('xl/_rels/workbook.xml.rels')));
 const selected=elements(book,'sheet').find(n=>n.getAttribute('name')===sheetName);if(!selected)throw new Error('Template sheet not found');
 const rid=selected.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 const target=elements(rels,'Relationship').find(n=>n.getAttribute('Id')===rid)?.getAttribute('Target');
 if(!target)throw new Error('Worksheet relationship missing');const path=target.startsWith('/')?target.slice(1):'xl/'+target;
 const doc=xml(dec.decode(files.get(path))),sheetData=elements(doc,'sheetData')[0],allRows=elements(sheetData,'row');
 const styleRow=allRows.find(n=>+n.getAttribute('r')===firstDataRow)||allRows.find(n=>+n.getAttribute('r')>firstDataRow);
 const styles=new Map((styleRow?elements(styleRow,'c'):[]).map(c=>[c.getAttribute('r').replace(/\d+$/,''),c.getAttribute('s')]));
 for(const row of allRows)if(+row.getAttribute('r')>=firstDataRow)row.remove();
 const letter=i=>utils.encode_col(i),serial=s=>(Date.parse(s+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
 const create=name=>doc.createElementNS(XML,name);
 ready.forEach((r,index)=>{
  const n=firstDataRow+index,row=create('row');row.setAttribute('r',n);if(styleRow)for(const a of Array.from(styleRow.attributes))if(a.name!=='r')row.setAttribute(a.name,a.value);
  const data={material:r.material,plant:'Tawas City',supplier:r.supplier,incoterms:r.incoterms,price:r.price,ratio:r.ratio,purchase:r.purchase,effective:serial(r.effective),expiration:serial(r.expiration),po:r.po};
  for(const [field,col]of Object.entries(columns).sort((a,b)=>a[1]-b[1])){
   const c=create('c'),ref=letter(col)+n;c.setAttribute('r',ref);const style=styles.get(letter(col));if(style!==null&&style!==undefined)c.setAttribute('s',style);
   if(['price','ratio','purchase','effective','expiration'].includes(field)){
    if(field==='purchase'){const f=create('f');f.textContent=`ROUND(${letter(columns.price)}${n}*${letter(columns.ratio)}${n},4)`;c.append(f);}
    const v=create('v');v.textContent=String(data[field]);c.append(v);
   }else{c.setAttribute('t','inlineStr');const is=create('is'),t=create('t');t.textContent=data[field];is.append(t);c.append(is);}
   row.append(c);
  }sheetData.append(row);
 });
 for(const d of elements(doc,'dimension'))d.setAttribute('ref',`A1:${letter(Math.max(...Object.values(columns)))}${firstDataRow+ready.length-1}`);
 files.set(path,enc.encode(new XMLSerializer().serializeToString(doc)));
 // Calc chain refers to removed old rows; Excel will rebuild it on open.
 files.delete('xl/calcChain.xml');
 for(const [name,type]of [['xl/_rels/workbook.xml.rels','Relationship'],['[Content_Types].xml','Override']]){const d=xml(dec.decode(files.get(name)));for(const n of elements(d,type))if(/calcChain/i.test(n.getAttribute('Target')||n.getAttribute('PartName')||''))n.remove();files.set(name,enc.encode(new XMLSerializer().serializeToString(d)));}
 return zipBytes(files);
}
export function reviewWorkbook(report,meta){const wb=utils.book_new();for(const [name,rows]of [['Ready 可维护',report.ready],['Needs confirmation 待确认',report.issues],['Run 运行记录',Object.entries(meta).map(([key,value])=>({key,value:JSON.stringify(value)}))]]){
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))],matrix=[keys,...rows.map(r=>keys.map(k=>({t:'s',v:String(r[k]??'')})))];const sheet=utils.aoa_to_sheet(matrix);sheet['!cols']=keys.map(()=>({wch:24}));utils.book_append_sheet(wb,sheet,name);
 }return new Blob([write(wb,{type:'array',bookType:'xlsx',compression:true})]);}
