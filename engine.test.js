const assert=require('node:assert/strict');const {calculate,detect,demo}=require('./engine.js');
const p=calculate(demo).positions.find(x=>x.key.includes('DE000TUAG505'));assert.equal(p.quantity,'20022.00');assert.equal(p.cost,'381218.00');assert.equal(p.lots.length,2);assert.equal(p.lots[0].date,'2022-10-04');
const sale=calculate([...demo,{date:'2023-06-01',type:'sell',isin:'DE000TUAG505',currency:'EUR',qty:'6000',price:'20'}]).sales[0];assert.equal(sale.basis,'303395.90');assert.equal(sale.pnl,'-183395.90');
assert.throws(()=>calculate([{date:'2023-01-01',type:'sell',isin:'A',currency:'USD',qty:'1',price:'1'}]),/Недостаточно/);
assert.equal(detect([{date:'2023-01-01',type:'out',isin:'A',currency:'USD',qty:'10'},{date:'2023-01-02',type:'in',isin:'B',currency:'USD',qty:'1'}]).length,1);
console.log('Tests passed');