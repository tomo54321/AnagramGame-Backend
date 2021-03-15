const crypto = require("crypto");
const { RoomState } = require("../constants/RoomStates");
const Player = require("./Player");
const { socketServer } = require("../server");
const { GetGameSetup } = require("../modules/Game");

class Room {
    constructor(adminSocket) {
        this.id = crypto.createHash("md5").update(`${adminSocket.data.username}-${Date.now()}`).digest("hex");
        this.name = `${adminSocket.data.username}'s Room`;
        this.adminId = adminSocket.id;
        this.players = [];
        this.state = RoomState.IN_LOBBY;

        this.letters = [];
        this.allWords = [];

        this.clock = 60; // Default game clock.
        this.clockInterval;

        this.onCreated(adminSocket);

        this.onClockTick = this.onClockTick.bind(this);
        this.onUserSubmitGuess = this.onUserSubmitGuess.bind(this);
    }

    /**
     * Stuff to do once the room has been created.
     * @param {Socket} socket 
     */
    onCreated(socket){
        // Create the player
        const player = new Player(socket);
        // Add player to room
        this.players.push(player);
        // Actually join this room.
        socket.join(this.id);
        socket.data.currentRoom = this.id;
        // Send the join room event to the client
        socket.emit("join room", this.toObject(socket));
    }

    onPlayerJoin(socket){
        // Check the game is in the lobby.
        if(this.state !== RoomState.IN_LOBBY){ return; }
        // Create the player
        const player = new Player(socket);
        // Add player to room
        this.players.push(player);
        // Join socket to room
        socket.join(this.id);
        socket.data.currentRoom = this.id;
        // Send back a join room response
        socket.emit("join room", this.toObject());
        socket.to(this.id).emit("player joined", player.toObject());
    }

    onPlayerLeave(socket){
        // That socket isn't in this room?
        if(socket.data.currentRoom !== this.id){ return; }
        // Find the player
        const playerObjectIndex = this.players.findIndex(player => player.socketId === socket.id);
        // Player isn't in this room??
        if(playerObjectIndex === -1){
            return false;
        }
        // Get the player instance
        const playerObject = this.players[playerObjectIndex];
        // Remove the player from our array
        this.players.splice(playerObjectIndex, 1);
        // Alert other players this user has left.
        socket.to(this.id).emit("player left", playerObject.id);
        // Handle setting a new admin as the player leaving was the admin
        if(this.adminId === socket.id && this.players.length > 0){
            this.adminId = this.players[0].socketId;
            socket.to(this.adminId).emit("new admin");
        }
        // Socket actually leaves the room
        socket.leave(this.id);
        socket.data.currentRoom === undefined;

    }

    onRoomDelete(){
        clearInterval(this.clockInterval);
    }

    onClockTick(){
        if(this.clock === 1){
            clearInterval(this.clockInterval);
            // What to do?
            if(this.state === RoomState.START_COUNTDOWN){ // The pre game countdown has ended?
                this.onStartGame(); // Start the game
            } else if(this.state === RoomState.IN_GAME) {
                this.onGameFinish(); // Conclude the game.
            } else {
                this.onReturnToLobby(); // Go back to the lobby.
            }
        }
        this.clock = this.clock - 1;
        socketServer.to(this.id).emit("update game clock", { time: this.clock });
    }

    /**
     * Leaderboard has been shown and now we return to the lobby.
     */
    onReturnToLobby(){
        this.state = RoomState.IN_LOBBY;
        this.letters = [];
        this.allWords = [];
        this.clock = 60;
        socketServer.to(this.id).emit("update game state", { 
            state: this.state,
            data: {
                allWords: [],
                letters: [],
                possibleWords: 0
            }
        });
    }

    /**
     * There is where players will be able to see all possible words, their guesses and the leaderboard
     */
    onGameFinish(){
        this.state = RoomState.GAME_FINISH;
        this.clock = 30;
        this.clockInterval = setInterval(this.onClockTick, 1000);
        socketServer.to(this.id).emit("update game state", { 
            state: this.state,
            data: {
                players: this.players.map(player => player.toObject()),
                allWords: this.allWords
            }
        });
    }

    /**
     * This is where the game state will change and the letters and combos are generated.
     */
    onStartGame(){
        const { letters, allWords } = GetGameSetup();
        this.letters = letters;
        this.allWords = allWords;
        this.state = RoomState.IN_GAME;
        this.clock = 120;
        this.clockInterval = setInterval(this.onClockTick, 1000);
        socketServer.to(this.id).emit("update game state", { 
            state: this.state,
            data: {
                letters: this.letters, 
                possibleWords: this.allWords.length
            }
        });
    }

    /**
     * When the countdown to start the game begins
     */
    onStartPreGameCountdown(){

        // First off reset all player points
        this.players.forEach(player => player.resetGameActions());

        // The three, two, one countdown to begin.
        this.state = RoomState.START_COUNTDOWN;
        this.clock = 3;
        this.clockInterval = setInterval(this.onClockTick, 1000);
        socketServer.to(this.id).emit("update game state", { 
            state: this.state,
            data: {
                players: this.players
            }
        });
    }

    toObject(socket = null){
        return {
            id: this.id,
            name: this.name,
            state: this.state,
            time: this.clock,
            admin: (socket !== null && socket.id === this.adminId),
            players: this.players.map((player) => player.toObject()),
            letters: this.letters, 
            possibleWords: this.allWords.length,
            allWords: []
        }
    }

    /**
     * Action Parser
     * @param {Socket} actionData 
     */
    onAction(actionData){
        const { socket, action, data } = actionData;
        switch(action){
            case "start game":
                this.onUserBeginGame(socket);
                break;
            case "submit guess":
                this.onUserSubmitGuess(socket, data);
                break;
            default:
                break;
        }
    }
    /**
     * User want's to start the game.
     * @param {Socket} socket 
     */
    onUserBeginGame(socket){
        // User is admin so can start game?
        if(this.adminId === socket.id && this.state === RoomState.IN_LOBBY && this.players.length > 1){
            this.onStartPreGameCountdown();
        }
    }
    /**
     * User submits a guess from the letters
     * @param {Socket} socket 
     * @param {string} guess 
     */
    onUserSubmitGuess(socket, guess){
        if(this.state !== RoomState.IN_GAME){ return; }

        const player = this.players.find(player => player.socketId === socket.id);
        // Guess is valid and hasn't already been gussed by this player?
        if(this.allWords.includes(guess) && !player.guessedWords.includes(guess)){
            // Add it to the players guesses
            player.guessedWords.push(guess); 

            // Update the players points
            player.points = player.points + guess.length; 

            // Tell the player they guessed right!
            socket.emit("guessed word", { word: guess.toLocaleLowerCase() });

            // Tell everyone that the player guessed right!
            socketServer.to(this.id).emit("player update", ({ playerId: player.id, data: player.toObject() }))
        } else {
            socket.emit("bad guess");
        }
    }
}

module.exports = Room;