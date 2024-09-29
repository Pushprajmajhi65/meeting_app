// import { json } from "express";
// const express = require("express");
var MyProcess = (function() {
    var serverProcess;
    var peers_connection = {};
    var peers_connection_ids = {};
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var video_st = null; // Initialize video state
    var rtp_vid_senders= [];
var video_states = {
    none: 0,
    Camera: 1,
    screenShare: 2
    
};
    async function _init(SDP_function, my_connid) {
        serverProcess = SDP_function;
        my_connection_id = my_connid; 
        eventProcess();
        local_div = document.getElementById("localVideoplayer");
    }

    function eventProcess() {
        $("#miceMuteUnmute").on("click", async function () {
            if (!audio) {
                await loadAudio();
            }
            if (!audio) {
                alert("Audio permission has not been provided");
                return;
            }
            if (isAudioMute) {
                audio.enabled = true;
                $(this).html("<span class='material-icons'>mic</span>");
                updateMediaSenders(audio, rtp_aud_senders);
            } else {
                audio.enabled = false;
                $(this).html("<span class='material-icons'>mic-off</span>");
                removeMediaSender(rtp_aud_senders);
            }
            isAudioMute = !isAudioMute;
        });

        $("#videoCamOnOff").on("click", async function () {
            await videoProcess(video_st === video_states.Camera ? video_states.none : video_states.Camera);
        });

        $("#btnScreenShareOnOff").on("click", async function () {
            await videoProcess(video_st === video_states.screenShare ? video_states.none : video_states.screenShare);
        });
    }
    function connectionm_status(connection){
        if(connection && (connection.connection== "new" ||
        connection.connection== "connecting" || 
        connection.connection== "connected"
        )){
            return true;
        }else{
            return false;
        }

    }
    async function updateMediaSenders( track, rtp_vid_senders ){
        for (var con_id in peers_connection_ids){
            if(connectionm_status(peers_connection[con_id])){
                if (rtp_senders[con_id]&& rtp_senders[con_id].track){
                    rtp_senders[con_id.replaceTrack(track)]
                }else{
                   rtp_senders[con_id]= peers_connection[con_id].addTrack(track); 
                }

                
            }
        }
    }

    async function videoProcess(newVideoState) {
        try {
            let vstream = null;
            if (newVideoState === video_states.Camera) {
                vstream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1920, height: 1080 },
                    audio: false
                });
            } else if (newVideoState === video_states.screenShare) {
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: 1920, height: 1080 },
                    audio: false
                });
            }
            if (vstream && vstream.getVideoTracks().length > 0) {
                videoCamTrack = vstream.getVideoTracks()[0];
                if (videoCamTrack) {
                    local_div.srcObject = new MediaStream([videoCamTrack]);
                    updateMediaSenders(videoCamTrack, rtp_vid_senders);
                }
            }
        } catch (error) {
            console.error("Error accessing video stream: ", error);
            alert("Error accessing video stream: " + error.message); // User feedback on error
            return;
        }
        video_st = newVideoState;
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
        remote_vid_stream[connId] = new MediaStream();
        remote_aud_stream[connId] = new MediaStream();
    }
    if (event.track.kind == "video") {
        remote_vid_stream[connId].getVideoTracks()
            .forEach((t) => remote_vid_stream[connId].removeTrack(t));
        remote_vid_stream[connId].addTrack(event.track);
        var remoteVideoPlayer = document.getElementById("v_" + connId);
        remoteVideoPlayer.srcObject = remote_vid_stream[connId];  // Ensure this is set correctly
        remoteVideoPlayer.load();  // Ensure the video element loads the stream
    } else if (event.track.kind == "audio") {
        remote_aud_stream[connId].getAudioTracks()
            .forEach((t) => remote_aud_stream[connId].removeTrack(t));
        remote_aud_stream[connId].addTrack(event.track);
        var remoteAudioPlayer = document.getElementById("a_" + connId);
        remoteAudioPlayer.srcObject = remote_aud_stream[connId];  // Ensure this is set correctly
        remoteAudioPlayer.load();  // Ensure the audio element loads the stream
    }
};


        peers_connection_ids[connId] = connId;
        peers_connection[connId] = connection;

        return connection;
        if (video_st== video_st.Camera || video_st == video_states.screenShare){
            if(videoCamTrack){
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
    }
    }

    async function setOffer(connId) {
        var connection = peers_connection[connId];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer); // Corrected function name

        serverProcess(JSON.stringify({ offer: connection.localDescription }),
         connId); // Use localDescription here
    }

    async function SDPProcess(message, from_connid) {
        message = JSON.parse(message);
        if (message.answer) {
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.offer) {
            if (!peers_connection[from_connid]) {
                await setNewConnection(from_connid);
            }
            await peers_connection[from_connid].setRemoteDescription(new 
                RTCSessionDescription(message.offer))
            var answer= await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(JSON.stringify({ answer: answer }), from_connid);
        } else if (message.icecandidate) {
            if (!peers_connection[from_connid]) {
                await setNewConnection(from_connid);
            }
            try {
                await peers_connection[from_connid].addIceCandidate(message.icecandidate);
            } catch (e) {
                console.log("Error adding ICE candidate: ", e);
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
        // $("#meetingContainer").show();
         $("#nameMe").text(user_id );
        // // document.title = user_id;
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
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meeting_id: meeting_id
                    });
                }
            }
            console.log("Socket connected with ID:", socket.id);
        });

        socket.on("inform_other_about_me", function (data) {
            addUser(data.other_users_id, data.connId);
            MyProcess.setNewConnection(data.connId);
        });

        socket.on("inform_me_about_other_user", function (other_users) {
            if (other_users) {
                for (var i = 0; i < other_users.length; i++) {
                    addUser(other_users[i].userId, other_users[i].connId);
                    MyProcess.setNewConnection(other_users[i].connId);
                }
            }
        });

        socket.on("SDPProcess", async function (data) {
            await MyProcess.processClientFunc(data.message, data.from_conn_id);
        });
    }

    function addUser(other_user_id, connId) {
        var newDivId = $("#otherTemplate").clone(); // Correct ID
        newDivId = newDivId.attr("id", connId).addClass("other");
        newDivId.find("h2").text(other_user_id);
        newDivId.find("video").attr("id", "v_" + connId);
        newDivId.find("audio").attr("id", "a_" + connId);
        
        // Ensure the div is visible
        newDivId.css("display", "flex");
    
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
