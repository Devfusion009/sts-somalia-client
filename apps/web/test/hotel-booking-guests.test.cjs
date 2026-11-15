const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/modules/hotels/booking-options.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod, mod.exports);
const {bookingGuestDetails, readStayDetails} = mod.exports;
function form(values) { const f = new FormData(); for (const [key,value] of Object.entries(values)) f.set(key,value); return f; }
test('additional guests do not replace the customer staying at the hotel', () => {
  assert.deepEqual(bookingGuestDetails(form({guestNames:'Other Adult\nChild'}), 'Demo Customer'), [{full_name:'Demo Customer'},{full_name:'Other Adult'},{full_name:'Child'}]);
});
test('booking for someone else saves the staying guest and phone instead of the booker', () => {
  assert.deepEqual(bookingGuestDetails(form({bookedForOther:'on',leadName:' Staying Guest ',leadPhone:' +252123456789 ',guestNames:'Companion'}),'Booker'), [{full_name:'Staying Guest',phone:'+252123456789'},{full_name:'Companion'}]);
});
test('a stale hidden staying guest does not override the booker when unchecked', () => {
  assert.deepEqual(bookingGuestDetails(form({leadName:'Old Guest',guestNames:'\n  \n'}),'Booker'), [{full_name:'Booker'}]);
});
test('room preferences retain their room positions with empty earlier rooms', () => {
  const stay=readStayDetails({arrival_time:'12:00–13:00',purpose:'business',preferences:[{}, {bed:'Twin beds',smoking:'Non-smoking',cot:'Baby cot needed',location:'Quiet room'}]});
  assert.equal(stay.preferences[0].bed,undefined);
  assert.equal(stay.preferences[1].location,'Quiet room');
  assert.equal(stay.arrival_time,'12:00–13:00');
});
