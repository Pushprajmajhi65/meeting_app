const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = app.listen(4000, function() {
    console.log("Server is running on http://localhost:4000");
});

const io = new Server(server, {
    allowEIO3: true
});

// Serve static files
app.use(express.static(path.join(__dirname, "")));
var userConnections = [];

// Handle socket connections
io.on("connection", (socket) => {
    console.log("Socket ID is", socket.id);

    // Handle userconnect event
    socket.on("userconnect", (data) => {
        console.log("userconnect", data.displayName, data.meeting_id); // Corrected variable name

        // Find other users in the same meeting
        var other_users = userConnections.filter((p) => p.meeting_id == data.meeting_id);

        // Add the current user to the userConnections array
        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meeting_id, 
        });

        // Inform other users in the meeting about the new connection
        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_other_about_me", {
                other_users_id: data.displayName,
                connId: socket.id,
            });
        })
        socket.emit("infrom_me_about_other_user", other_users);



    });
    socket.on("SDPProcess", (data)=> {
        socket.to(data.to_connid).emit("SDPProcess"),{
            message: data.message,
            from_connid: socket.id,
        }
    })
});
