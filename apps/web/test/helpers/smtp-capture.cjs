// Loopback-only SMTP fixture. Never forwards mail; accepts disposable QA credentials.
const net = require('node:net');
function createSmtpCapture(onMessage, { rejectMessages = 0 } = {}) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.write('220 localhost QA capture\r\n');
    let buffer = '', receiving = false, lines = [], recipients = [];
    socket.on('data', chunk => {
      buffer += chunk.toString();
      let boundary;
      while ((boundary = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (receiving) {
          if (line !== '.') { lines.push(line.replace(/^\.\./, '.')); continue; }
          const accepted = rejectMessages === 0;
          if (!accepted) rejectMessages--;
          onMessage({ recipients, message: lines.join('\r\n'), accepted });
          receiving = false; lines = []; recipients = [];
          socket.write(accepted ? '250 Captured\r\n' : '451 Temporary SMTP failure\r\n');
          continue;
        }
        const command = line.split(' ')[0].toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 20000000\r\n');
        else if (command === 'AUTH') socket.write('235 Authentication successful\r\n');
        else if (command === 'DATA') { receiving = true; socket.write('354 Send message\r\n'); }
        else if (command === 'QUIT') socket.end('221 Bye\r\n');
        else { if (command === 'RCPT') recipients.push(line); socket.write('250 OK\r\n'); }
      }
    });
  });
  return {
    listen: (port = 0) => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => resolve(server.address().port));
    }),
    close: () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve); }),
  };
}
module.exports = { createSmtpCapture };
