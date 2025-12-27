// backend/socket.js
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app'); // your Express app
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('sendMessage', (data) => {
    // Save message to DB if needed
    io.emit('newMessage', data);
  });

  socket.on('joinLiveStream', (streamId) => {
    socket.join(streamId);
    io.to(streamId).emit('userJoined', { userId: socket.id });
  });

  socket.on('leaveLiveStream', (streamId) => {
    socket.leave(streamId);
    io.to(streamId).emit('userLeft', { userId: socket.id });
  });

  socket.on('sendLiveComment', ({ streamId, comment }) => {
    io.to(streamId).emit('newLiveComment', comment);
  });
});

server.listen(5000, () => console.log('Socket server running on port 5000'));
