/* FinRez Intelligence — deterministic prototype, decimal fixed point */
const SCALE=100000000n;
function dec(v){let s=String(v??'').trim().replace(/\s/g,'').replace(',','.');if(!/^[+-]?\d+(\.\d+)?$/.test(s))throw Error('Некорректное число: '+s);let neg=s.startsWith('-');s=s.replace(/^[+-]/,'');let [a,b='']=s.split('.');if(b.length>8)throw Error('Точность больше 8 знаков');return (BigInt(a)*SCALE+BigInt(b.padEnd(8,'0')))*(neg?-1n:1n)}
function fmt(x){let n=x<0n?-x:x;return (x<0n?'-':'')+(n/SCALE)+'.'+String(n%SCALE).padStart(8,'0').replace(/0+$/,'').padEnd(2,'0')}
const mul=(a,b)=>a*b/SCALE;
function calculate(ops){
 const books=new Map(),audit=[],sales=[];let serial=0;
 const key=(o,s=o.isin)=>[o.account||'default',s,o.currency].join('|');
 const book=k=>{if(!books.has(k))books.set(k,[]);return books.get(k)};
 const snap=k=>{let l=book(k),q=l.reduce((a,x)=>a+x.q,0n),c=l.reduce((a,x)=>a+x.c,0n);return {quantity:fmt(q),cost:fmt(c),price:q?fmt(c*SCALE/q):'—'}};
 function add(k,q,c,date,parent){if(q<=0n||c<0n)throw Error('Недопустимый лот');book(k).push({id:++serial,q,c,date,parent});book(k).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id)}
 function take(k,q){if(q<=0n)throw Error('Количество должно быть положительным');let l=book(k);if(l.reduce((a,x)=>a+x.q,0n)<q)throw Error('Недостаточно остатка: '+k);let out=[];while(q){let x=l[0],n=q<x.q?q:x.q,c=n===x.q?x.c:x.c*n/x.q;out.push({...x,q:n,c});x.q-=n;x.c-=c;q-=n;if(!x.q)l.shift()}return out}
 let ordered=ops.map((o,i)=>({...o,seq:i})).sort((a,b)=>a.date.localeCompare(b.date)||a.seq-b.seq);
 for(let o of ordered){if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||!o.isin||!o.currency)throw Error('Обязательны дата ISO, ISIN и валюта');let k=key(o),target=key(o,o.target||o.isin),before=snap(k),tb=snap(target),q=dec(o.qty),p=dec(o.price||'0'),fee=dec(o.fee||'0');if(q<=0n||p<0n||fee<0n)throw Error('Недопустимые параметры');
 if(o.type==='buy'||o.type==='opening')add(k,q,mul(q,p)+fee,o.date,null);
 else if(o.type==='sell'){let c=take(k,q).reduce((a,x)=>a+x.c,0n),v=mul(q,p)-fee;sales.push({date:o.date,isin:o.isin,currency:o.currency,quantity:fmt(q),proceeds:fmt(v),basis:fmt(c),pnl:fmt(v-c)})}
 else if(o.type==='split'||o.type==='exchange'){let n=dec(o.newQty),l=take(k,q);if(n<=0n)throw Error('Количество после события должно быть положительным');let used=0n;l.forEach((x,i)=>{let z=i===l.length-1?n-used:x.q*n/q;if(z<=0n)throw Error('Дробный лот требует ручной проверки');used+=z;add(target,z,x.c,x.date,x.id)})}
 else if(o.type==='rights'){if(!o.target||o.target===o.isin)throw Error('Укажите ISIN прав');add(target,q,0n,o.date,null)}
 else if(o.type==='exercise'){if(!o.target||o.target===o.isin)throw Error('Укажите ISIN акций');let c=take(k,q).reduce((a,x)=>a+x.c,0n),n=dec(o.newQty);add(target,n,c+mul(n,p)+fee,o.date,null)}
 else if(o.type==='expire'){let c=take(k,q).reduce((a,x)=>a+x.c,0n);if(c)throw Error('Аннулирование ненулевой себестоимости требует правила учёта')}
 else if(o.type==='spinoff'){if(!o.target||o.target===o.isin)throw Error('Укажите ISIN новой компании');let n=dec(o.newQty),a=dec(o.allocation);if(a<0n||a>dec(100))throw Error('Доля вне диапазона');let l=book(k),total=l.reduce((s,x)=>s+x.q,0n);if(total!==q)throw Error('Spin-off: требуется полная позиция');let used=0n;l.forEach((x,i)=>{let z=i===l.length-1?n-used:x.q*n/q;if(z<=0n)throw Error('Дробные акции требуют проверки');used+=z;let c=x.c*a/dec(100);x.c-=c;add(target,z,c,x.date,x.id)})}
 else throw Error('Неподтверждённый тип: '+o.type);
 audit.push({date:o.date,type:o.type,isin:o.isin,target:o.target||'',before,after:snap(k),targetBefore:tb,targetAfter:snap(target)});
 }
 return {audit,sales,positions:[...books].map(([key,l])=>({key,...snap(key),lots:l.map(x=>({id:x.id,parent:x.parent,date:x.date,qty:fmt(x.q),basis:fmt(x.c),price:fmt(x.c*SCALE/x.q)}))}))}
}
function detect(rows){const out=[];for(let i=0;i<rows.length;i++){let a=rows[i];if(a.type!=='out')continue;for(let j=0;j<rows.length;j++){let b=rows[j];if(b.type!=='in'||a.isin===b.isin||a.account!==b.account||a.currency!==b.currency)continue;let days=(Date.parse(b.date)-Date.parse(a.date))/86400000;if(days<0||days>30||!Number.isFinite(days))continue;let q=Number(a.qty),n=Number(b.qty);if(q>0&&n>0)out.push({out:i,in:j,source:a.isin,target:b.isin,date:a.date,ratio:n/q,status:'Кандидат — требуется подтверждение'})}}return out}
const demo=[{date:'2022-10-04',type:'opening',isin:'DE000TUAG000',currency:'EUR',qty:'54620',price:'5.50'},{date:'2023-03-02',type:'split',isin:'DE000TUAG000',target:'DE000TUAG505',currency:'EUR',qty:'54620',newQty:'5462'},{date:'2023-03-30',type:'rights',isin:'DE000TUAG505',target:'DE000TUAG1E4',currency:'EUR',qty:'5462'},{date:'2023-04-17',type:'exercise',isin:'DE000TUAG1E4',target:'DE000TUAG505',currency:'EUR',qty:'5460',newQty:'14560',price:'5.55'},{date:'2023-05-01',type:'expire',isin:'DE000TUAG1E4',currency:'EUR',qty:'2'}];
if(typeof module!=='undefined')module.exports={calculate,detect,demo,dec,fmt};