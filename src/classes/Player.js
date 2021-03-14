const crypto = require("crypto");
class Player {
    constructor(playerSocket, isAdmin = false) {
        this.id = crypto.createHash("md5").update(playerSocket.id).digest("hex");
        this.socketId = playerSocket.id;
        this.username = playerSocket.data.username;
        this.isAdmin = isAdmin;
        this.guessedWords = [];
        this.points = 0;
    }

    resetGameActions(){
        this.points = 0;
        this.guessedWords = [];
    }

    toObject(){
        return {
            id: this.id,
            username: this.username,
            points: this.points
        }
    }
    
}

module.exports = Player;