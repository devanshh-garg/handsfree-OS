const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  
  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
      methods: ['GET', 'POST']
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join restaurant room (in real app, this would be restaurant-specific)
    socket.join('restaurant-main');

    // Handle order events
    socket.on('order:update', (data) => {
      console.log('Order update:', data);
      socket.to('restaurant-main').emit('order:updated', data);
    });

    socket.on('order:create', (data) => {
      console.log('Order created:', data);
      io.to('restaurant-main').emit('order:created', data);
    });

    socket.on('order:complete', (data) => {
      console.log('Order completed:', data);
      io.to('restaurant-main').emit('order:completed', data);
    });

    // Handle table events
    socket.on('table:statusChange', (data) => {
      console.log('Table status change:', data);
      io.to('restaurant-main').emit('table:statusChanged', data);
    });

    // Handle inventory events
    socket.on('inventory:alert', (data) => {
      console.log('Inventory alert:', data);
      io.to('restaurant-main').emit('inventory:alert', data);
    });

    // Handle metrics updates
    socket.on('metrics:update', (data) => {
      console.log('Metrics update:', data);
      io.to('restaurant-main').emit('metric:updated', data);
    });

    // Handle voice commands
    socket.on('voice:command', (data) => {
      console.log('Voice command:', data);
      // Process voice command and emit appropriate events
      processVoiceCommand(socket, data);
    });

    // Room management
    socket.on('join:room', (room) => {
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
      socket.emit('room:joined', room);
    });

    socket.on('leave:room', (room) => {
      socket.leave(room);
      console.log(`Client ${socket.id} left room: ${room}`);
      socket.emit('room:left', room);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // Voice command processing
  function processVoiceCommand(socket, commandData) {
    const { command, action, parameters } = commandData;
    
    switch (action?.type) {
      case 'order':
        if (action.subtype === 'mark_ready' && parameters.tableNumber) {
          io.to('restaurant-main').emit('order:updated', {
            tableId: `table-${parameters.tableNumber}`,
            status: 'ready',
            timestamp: new Date()
          });
        }
        break;
        
      case 'table':
        if (action.subtype === 'mark_cleaning' && parameters.tableNumber) {
          io.to('restaurant-main').emit('table:statusChanged', {
            tableId: `table-${parameters.tableNumber}`,
            status: 'cleaning',
            timestamp: new Date()
          });
        }
        break;
        
      case 'inventory':
        if (parameters.itemName) {
          io.to('restaurant-main').emit('inventory:alert', {
            itemName: parameters.itemName,
            alertType: 'manual_update',
            message: `${parameters.itemName} inventory updated via voice command`,
            timestamp: new Date()
          });
        }
        break;
    }
  }

  // Demo data simulation (optional - can be removed in production)
  if (dev) {
    setInterval(() => {
      // Simulate random order updates
      const randomEvents = [
        {
          type: 'order:updated',
          data: {
            orderId: `order-${Math.floor(Math.random() * 5) + 1}`,
            status: ['preparing', 'ready'][Math.floor(Math.random() * 2)],
            timestamp: new Date()
          }
        },
        {
          type: 'table:statusChanged',
          data: {
            tableId: `table-${Math.floor(Math.random() * 8) + 1}`,
            status: ['available', 'occupied'][Math.floor(Math.random() * 2)],
            timestamp: new Date()
          }
        }
      ];

      const randomEvent = randomEvents[Math.floor(Math.random() * randomEvents.length)];
      io.to('restaurant-main').emit(randomEvent.type, randomEvent.data);
    }, 60000); // Every minute
  }

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running on the same port`);
  });
}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});