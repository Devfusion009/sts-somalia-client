import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageUpsertSchema } from '../dist/index.js';
const valid = {
 organizerName:'STS Somalia',organizerEmail:'organizer@example.com',packageType:'group',name:'Ramadan Umrah',description:'Ten-day group pilgrimage',durationDays:10,
 includes:['hotel','transport','meals','flights'],basePrice:1500,currency:'USD',status:'draft',
 contactPersonName:'Trip coordinator',contactPersonPhone:'+252 611 444 420',
 facilities:'Guide and wheelchair assistance',accommodationDetails:'Makkah and Madinah hotels, quad sharing',
 flightDetails:'Return economy flights MGQ–JED',transportDetails:'Airport and intercity coach transfers',
 mealsNote:'Breakfast and dinner',nightsMakkah:5,nightsMadinah:4,totalSeats:20,departureDate:'2027-03-01',
};
test('complete public package is accepted',()=>assert.equal(packageUpsertSchema.parse(valid).totalSeats,20));
for (const key of ['name','description','contactPersonName','contactPersonPhone','facilities','accommodationDetails','flightDetails','transportDetails','mealsNote','totalSeats','departureDate']) {
 test(`public package requires ${key}`,()=>{const input={...valid};delete input[key];assert.equal(packageUpsertSchema.safeParse(input).success,false);});
}
for (const patch of [{totalSeats:0},{totalSeats:1.5},{durationDays:1},{basePrice:0},{contactPersonPhone:'123'},{nightsMakkah:7,nightsMadinah:4},{includes:[]}]) {
 test(`invalid public configuration ${JSON.stringify(patch)}`,()=>assert.equal(packageUpsertSchema.safeParse({...valid,...patch}).success,false));
}
test('private package keeps its existing setup contract',()=>assert.equal(packageUpsertSchema.safeParse({packageType:'private',name:'Private trip',durationDays:12,basePrice:0,currency:'USD',includes:[],status:'draft'}).success,true));
test('public agent contacts require a name and valid telephone number',()=>{
 assert.equal(packageUpsertSchema.safeParse({...valid,agentContacts:[{name:'Local Agent',phone:'+252 611 222 333'}]}).success,true);
 for(const contact of [{name:'',phone:'+252 611 222 333'},{name:'Agent',phone:'invalid'},{name:'Agent',phone:'611 222 333'},{name:'Agent',phone:'+12 34'},{name:'Agent',phone:'+1234567890123456'}])assert.equal(packageUpsertSchema.safeParse({...valid,agentContacts:[contact]}).success,false);
});
test('responsible person requires an international phone with 8 to 15 digits',()=>{
 for (const phone of ['611 444 420','+123 45','+1234567890123456','+252 61 ext. 44']) {
  assert.equal(packageUpsertSchema.safeParse({...valid,contactPersonPhone:phone}).success,false,phone);
 }
 assert.equal(packageUpsertSchema.safeParse({...valid,contactPersonPhone:'+252 (61) 144-4420'}).success,true);
});

test('public packages can omit city night counts',()=>{const input={...valid};delete input.nightsMakkah;delete input.nightsMadinah;assert.equal(packageUpsertSchema.safeParse(input).success,true);});
