const http = require("http");
const httpServer = http.createServer();
const io = require("socket.io")(httpServer, {
    serveClient: false,
    path: "/",
    cors: {
        origin: "http://localhost:3000"
    }
});
exports.socketServer = io;

// This must be loaded in after the io export has been set so it can read it!
const Room = require("./classes/Room");

// A list of all the game rooms
let gameRooms = [];


io.on("connection", socket => {
    // User connected to server
    socket.data.username = socket.handshake.query.username;
    console.log("Connection!", socket.data.username);

    /**
     * User requested all the rooms.
     */
    socket.on("list rooms", () => {
        socket.emit("list rooms", gameRooms.map(room => room.toObject()));
    });

    /**
     * User is creating a room
     */
    socket.on("create room", () => {
        const room = new Room(socket);
        gameRooms.push(room);
    });

    /**
     * User is joining a room
     */
    socket.on("join room", ({ id }) => {
        const roomIndex = gameRooms.findIndex(rm => rm.id === id);
        if (roomIndex === -1) {
            socket.emit("error", { message: "Room not found." });
            return;
        }

        gameRooms[roomIndex].onPlayerJoin(socket);
    });

    /**
     * When someone does something in a room.
     */
    socket.on("room action", ({ action, data }) => {
        // Verify user in a room?
        if(socket.data.currentRoom){
            // Verify the room exists.
            const roomIndex = gameRooms.findIndex(rm => rm.id === socket.data.currentRoom);
            if (roomIndex !== -1) {
                gameRooms[roomIndex].onAction({ socket, action, data });
            }
        }
    });

    /**
     * User is leaving a room
     */
    socket.on("leave room", () => {
        handleUserLeaveRoom(socket);
    });

    // User disconnected from server.
    socket.on("disconnect", () => {
        handleUserLeaveRoom(socket);
        console.log("Disconnect", socket.data.username);
    });
});

// Helper function to handle user disconnecting
const handleUserLeaveRoom = (socket) => {
    // Check they're in a room first
    if (socket.data.currentRoom) {
        const roomIndex = gameRooms.findIndex(rm => rm.id === socket.data.currentRoom);
        if (roomIndex !== -1) { // Room exists!
            gameRooms[roomIndex].onPlayerLeave(socket);
            // No one left in this room?
            if(gameRooms[roomIndex].players.length < 1){
                // Clear the clock, if any are running!
                gameRooms[roomIndex].onRoomDelete();
                // Remove it!
                gameRooms.splice(roomIndex, 1);
            }
        }
    }
};

const PORT = 8080;
httpServer.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
