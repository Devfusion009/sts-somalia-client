const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = resolve(__dirname, '../../..');
function load(relative, mocks={}) {
 const file=resolve(root,relative), mod=new Module(file,module);
 mod.filename=file;
 mod.require=id=> mocks[id] ?? (id==='@nestjs/common' ? {Injectable:()=>v=>v,BadRequestException:Error} : {});
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,experimentalDecorators:true}}).outputText,file);
 return mod.exports;
}
const {privatePackageGroupKey:key}=load('apps/web/src/modules/umrah/private-package-groups.ts');
const snapshot={packageId:'package-a',name:'Umrah',origin:'MGQ',destination:'JED',departureDate:'2027-01-10',returnDate:'2027-01-18'};
test('only identical package, route and travel dates share a review group',()=>{
 const a={id:'one',package_snapshot:snapshot};
 assert.equal(key(a),key({id:'two',package_snapshot:{...snapshot,name:'Renamed'}}));
 for(const change of [{packageId:'package-b'},{origin:'HGA'},{destination:'MED'},{departureDate:'2027-01-11'},{returnDate:'2027-01-19'}])
  assert.notEqual(key(a),key({id:'two',package_snapshot:{...snapshot,...change}}));
 assert.notEqual(key({id:'one'}),key({id:'two'}));
});
for(const kind of ['private','group']) test(`${kind} package booking returns the correct approval requirement and hold policy`,async()=>{
 let orderInput;
 const {GroupBookingService}=load('apps/api/src/modules/umrah/services/group-booking.service.ts',{'@sts/shared-types':{groupBookingErrorMessage:()=> 'Booking failed'}});
 const repo={createGroupBooking:async()=>({id:'booking',error:null}),findPrice:async()=>({id:'booking',total_price:1200,currency:'USD',booking_kind:kind}),delete:assert.fail};
 const orders={getActiveAgencyId:async()=> 'agency',assertAgencyCanBookProduct:async()=>({ok:true}),resolveBookedForCustomer:async()=> 'customer',createForBooking:async input=>{orderInput=input;return {id:'order'};}};
 const result=await new GroupBookingService(repo,orders).create('user',{departureId:'departure',numPilgrims:1,pilgrims:[{full_name:'Test Traveller',gender:'male'}],hold:true});
 assert.equal(result.requiresApproval,kind==='private');
 assert.equal(orderInput.hold,kind==='group');
 assert.equal(orderInput.price,1200);
});
for(const methodId of ['wallet','card','waafi']) test(`pending private request cannot initiate ${methodId} payment`,async()=>{
 const {PaymentsService}=load('apps/api/src/modules/payments/payments.service.ts');
 const tables=[];
 const db={from(table){tables.push(table);assert.ok(['orders','order_items'].includes(table));
  return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'order',status:'pending_payment'}}),then(resolve){return Promise.resolve({data:[{umrah_booking:{booking_kind:'private',status:'pending'}}]}).then(resolve);}};}};
 const result=await new PaymentsService({get:()=>db},{},{},{},{}).initiatePayment('user',{orderId:'order',methodId});
 assert.equal(result.error,'This booking is waiting for confirmation.');
 assert.deepEqual(tables,['orders','order_items']);
});
test('payment fails closed if booking state cannot be read',async()=>{
 const {PaymentsService}=load('apps/api/src/modules/payments/payments.service.ts');
 const db={from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'order',status:'pending_payment'}}),then(resolve){return Promise.resolve({data:null,error:{message:'Unavailable'}}).then(resolve);}};}};
 const result=await new PaymentsService({get:()=>db},{},{},{},{}).initiatePayment('user',{orderId:'order',methodId:'wallet'});
 assert.equal(result.error,'Booking confirmation could not be checked.');
});
for(const booking of [{booking_kind:'private',status:'confirmed'},{booking_kind:'group',status:'pending'}]) test(`${booking.booking_kind} ${booking.status} proceeds past the approval gate`,async()=>{
 const {PaymentsService}=load('apps/api/src/modules/payments/payments.service.ts',{'@sts/shared-types':{MIN_DEPOSIT_FRACTION:.5,hallAwaitingQuote:()=>false},'./registry':{getPaymentMethod:async()=>null}});
 let itemReads=0, paymentRead=false;
 const db={from(table){
  const data=table==='payments' ? [] : (++itemReads===1 ? [{umrah_booking:booking}] : []);
  if(table==='payments')paymentRead=true;
  return {select(){return this;},eq(){return this;},not(){return this;},maybeSingle:async()=>({data:{id:'order',status:'pending_payment',total:100,currency:'USD'}}),then(resolve){return Promise.resolve({data}).then(resolve);}};}};
 // Count only order-item reads; the first call reads the order itself.
 itemReads=-1;
 const result=await new PaymentsService({get:()=>db},{},{},{},{}).initiatePayment('user',{orderId:'order',methodId:'card'});
 assert.equal(paymentRead,true);
 assert.equal(result.error,'That payment method is not available.');
});
