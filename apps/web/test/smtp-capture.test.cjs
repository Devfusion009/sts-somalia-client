const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { createSmtpCapture } = require('./helpers/smtp-capture.cjs');
test('QA sink accepts the authenticated SMTP transport and captures without external delivery', async () => {
  const messages = [];
  const sink = createSmtpCapture(message => messages.push(message));
  let transport;
  try {
    const port = await sink.listen();
    transport = nodemailer.createTransport({host:'127.0.0.1',port,secure:false,auth:{user:'qa',pass:'qa'},pool:true});
    const result = await transport.sendMail({from:'qa@example.test',to:'customer@example.test',subject:'QA request received',text:'Awaiting group completion. No payment due.'});
    assert.deepEqual(result.accepted,['customer@example.test']);
    assert.equal(messages.length,1);
    assert.match(messages[0].message,/Awaiting group completion/);
    assert.match(messages[0].recipients[0],/customer@example.test/);
  } finally { transport?.close(); await sink.close(); }
});
