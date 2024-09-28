const { json } = require("express");

var MyProcess = (function() {
    var serverProcess;
    var peers_connection = {};
    var peers_connection_ids = {};
    var remote_vid_stream = [];
    var remote_aud_stream = [];

    async function _init(SDP_function, my_connid) {
        serverProcess = SDP_function;
        my_connection_id = my_connid; 
    }

    var iceconfiguration = {
        iceServers: [ 
            {
                urls: "stun:stun.l.google.com:19302",
            },
            {
                urls: "stun:stun.l.google.com:19303",
            },
        ]
    };

    async function setNewConnection(connId) {
        var connection = new RTCPeerConnection(iceconfiguration);

        connection.onnegotiationneeded = async function(event) {
            await setOffer(connId);
        };

        connection.onicecandidate = function(event) {
            if (event.candidate) {
                serverProcess(JSON.stringify({ Icecandidate: event.candidate }), connId);
            }
        };

        connection.ontrack = function(event) {
            if (!remote_vid_stream[connId]){
                remote_vid_stream[connid]= new MediaStream();
                remote_aud_stream[connid]= new MediaStream();
            }
            if(event.track.kind== "video"){
                remote_vid_stream[connId].getVideoTracks()
                .forEach((t)=>remote_vid_stream[connId].removeTrack(t));
                remote_vid_stream[connId].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_"+connId);
                remoteVideoPlayer.srcObject=null;
                remoteVideoPlayer.srcObject= remote_vid_stream[connId];
                remoteVideoPlayer.load();
            }else if(event.track.kind=="audio"){
                remote_aud_stream[connId]
                .getAudioTracks()
                .forEach((t)=>remote_aud_stream[connId].removeTrack(t));
                remote_aud_stream[connId].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_"+connId);
                remoteAudioPlayer.srcObject=null;
                remoteAudioPlayer.srcObject= remote_aud_stream[connId];
                remoteAudioPlayer.load();
            }
           
        };

        peers_connection_ids[connId] = connId;
        peers_connection[connId] = connection;

        return connection;
    }

    async function setOffer(connId) {
        var connection = peers_connection[connId];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer); // Corrected function name

        serverProcess(JSON.stringify({ offer: connection.localDescription }),
         connId); // Use localDescription here
    }
    async function SDPProcess(message, from_connid){
        message= JSON.parse(message);
        if(message.answer){
            await peers_connection[from_connid].setRemoteDescription(new
                 RTCSessionDescription(message.answer))

        }else if (message.offer){
            if(!peers_connection[from_connid]){
                await setNewConnection (from_connid);

            }
            await peers_connection[from_connid].setRemoteDescription(new 
                RTCSessionDescription(message.offer))
            var answer= await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(
                JSON.stringify({ 
                    answer: answer,
                 }),
                 from_connid); // Use localDescription here
    }else if(message.icecandidate){
        if(!peers_connection[from_connid]){
            await setNewConnection(from_connid);

        }
        try{
            await peers_connection[from_connid].addIceCandidate(message.icecandidate);
        }catch(e){
            console.log(e);
        }
    }

            

        }




    


    return {
        setNewConnection: async function(connId) {
            await setNewConnection(connId); // Corrected function call
        },
        init: async function(SDP_function, my_connid) {
            await _init(SDP_function, my_connid);
        },


        processClientFunc: async function(data, from_connid) {
            await SDPProcess(data, from_connid);
        },
    };
})();

var MyApp = (function() {
    var socket = null;
    var user_id = "";
    var meeting_id = "";

    function init(uid, mid) {
        user_id = uid;
        meeting_id = mid;
        event_process_for_signaling_server();
        console.log("User ID: " + uid + ", Meeting ID: " + mid);
    }

    function event_process_for_signaling_server() {
        socket = io(); // Corrected connection

        var SDP_function = function(data, to_conn_id) {
            socket.emit("SDPProcess", {
                message: data,
                to_conn_id: to_conn_id
            });
        };

        socket.on("connect", () => {
            if (socket.connected) {
                MyProcess.init(SDP_function, socket.id); // Changed to MyProcess
                if (user_id !== "" && meeting_id !== "") {
                    // Emit the "userconnect" event with the user_id and meeting_id
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meeting_id: meeting_id, // Corrected variable name
                    });
                }
            }
            console.log("Socket connected with ID:", socket.id); // Log socket ID on connection
        });

        // this will let me know about other user who have joined.
        

        socket.on("inform_other_about_me", function(data) {
            addUser(data.other_users_id, data.connId); // Fixed parameter names
            MyProcess.setNewConnection(data.connId); // Changed to MyProcess
        });
        socket.on("infrom_me_about_other_user", function(other_users) {
            if (other_users){
                for(var i = 0; i < other_users.length; i++){
                    addUser(other_users[i].user_id ,
                    other_users[i].connectionId)
                    
            MyProcess.setNewConnection(other_users[i].connectionId); 
                } 
            }

            
        });
        socket.on("SDPProcess", async function (data){
            await AppProcess.processClientFunc(data.message, data.from_connid);
        })
    }

    function addUser(other_user_id, connId) {
        var newDivId = $("#otherTemplat").clone();
        newDivId = newDivId.attr("id", connId).addClass("other");
        newDivId.find("h2").text(other_user_id);
        newDivId.find("video").attr("id", "v_" + connId);
        newDivId.find("audio").attr("id", "a_" + connId);
        newDivId.show();
        $("#divUsers").append(newDivId);
    }

    return {
        _init: function(uid, mid) {
            init(uid, mid);
        }
    };
})();

// Initialize MyApp on document ready
$(document).ready(function() {
    // Example user ID and meeting ID; replace with actual values
    var uid = "exampleUser"; 
    var mid = "28828161"; 
    MyApp._init(uid, mid);
});
