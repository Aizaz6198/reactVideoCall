import React, { useState, useEffect, useRef, createContext } from "react";
import { socket } from "../config/config";
import Peer from "simple-peer";

const VideoCallContext = createContext();

const VideoCallProvider = ({ children }) => {
  const [userStream, setUserStream] = useState(null);
  const [call, setCall] = useState({});
  const [isCallAccepted, setIsCallAccepted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [partnerUserId, setPartnerUserId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [receivedMessage, setReceivedMessage] = useState("");
  const [name, setName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [isMyVideoActive, setIsMyVideoActive] = useState(true);
  const [isPartnerVideoActive, setIsPartnerVideoActive] = useState();
  const [isMyMicActive, setIsMyMicActive] = useState(true);
  const [isPartnerMicActive, setIsPartnerMicActive] = useState();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const myVideoRef = useRef();
  const partnerVideoRef = useRef();
  const peerConnectionRef = useRef();
  const screenShareTrackRef = useRef();

  useEffect(() => {
    const getUserMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setUserStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    const handleSocketEvents = () => {
      socket.on("socketId", setMyUserId);
      socket.on("mediaStatusChanged", ({ mediaType, isActive }) => {
        if (mediaType === "video") setIsPartnerVideoActive(isActive);
        if (mediaType === "audio") setIsPartnerMicActive(isActive);
        if (mediaType === "both") {
          setIsPartnerMicActive(isActive[0]);
          setIsPartnerVideoActive(isActive[1]);
        }
      });
      socket.on("callTerminated", () => {
        setIsCallEnded(true);
        window.location.reload();
      });
      socket.on("incomingCall", ({ from, name, signal }) => {
        setCall({ isReceivingCall: true, from, name, signal });
      });
      socket.on("receiveMessage", ({ message, senderName }) => {
        setReceivedMessage({ text: message, senderName });
        setTimeout(() => setReceivedMessage({}), 1000);
      });
    };

    getUserMediaStream();
    handleSocketEvents();
  }, []);

  const receiveCall = () => {
    setIsCallAccepted(true);
    setPartnerUserId(call.from);
    const peer = new Peer({ initiator: false, trickle: false, stream: userStream });
    peer.on("signal", (data) => {
      socket.emit("answerCall", {
        signal: data,
        to: call.from,
        userName: name,
        mediaType: "both",
        mediaStatus: [isMyMicActive, isMyVideoActive],
      });
    });
    peer.on("stream", (stream) => {
      if (partnerVideoRef.current) partnerVideoRef.current.srcObject = stream;
    });
    peer.signal(call.signal);
    peerConnectionRef.current = peer;
  };

  const callUser = (targetId) => {
    const peer = new Peer({ initiator: true, trickle: false, stream: userStream });
    setPartnerUserId(targetId);
    peer.on("signal", (data) => {
      socket.emit("initiateCall", { targetId, signalData: data, senderId: myUserId, senderName: name });
    });
    peer.on("stream", (stream) => {
      if (partnerVideoRef.current) partnerVideoRef.current.srcObject = stream;
    });
    socket.on("callAnswered", ({ signal, userName }) => {
      setIsCallAccepted(true);
      setOpponentName(userName);
      peer.signal(signal);
      socket.emit("changeMediaStatus", { mediaType: "both", isActive: [isMyMicActive, isMyVideoActive] });
    });
    peerConnectionRef.current = peer;
  };

  const toggleMedia = (mediaType) => {
    const isActive = mediaType === "video" ? !isMyVideoActive : !isMyMicActive;
    const setMediaState = mediaType === "video" ? setIsMyVideoActive : setIsMyMicActive;

    setMediaState(isActive);
    userStream[`get${mediaType === "video" ? "Video" : "Audio"}Tracks`]().forEach(track => track.enabled = isActive);

    socket.emit("changeMediaStatus", { mediaType, isActive });
    return isActive;
  };

  const toggleScreenSharingMode = () => {
    if (!isMyVideoActive) return alert("Please turn on your video to share the screen");
    if (!isScreenSharing) {
      navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(screenStream => {
        const screenTrack = screenStream.getTracks()[0];
        const videoTrack = userStream.getVideoTracks()[0];
        peerConnectionRef.current.replaceTrack(videoTrack, screenTrack, userStream);
        screenTrack.onended = () => {
          peerConnectionRef.current.replaceTrack(screenTrack, videoTrack, userStream);
          myVideoRef.current.srcObject = userStream;
          setIsScreenSharing(false);
        };
        myVideoRef.current.srcObject = screenStream;
        screenShareTrackRef.current = screenTrack;
        setIsScreenSharing(true);
      }).catch(() => console.log("Failed to get screen sharing stream"));
    } else {
      screenShareTrackRef.current.stop();
    }
  };

  const toggleFullScreen = (e) => {
    const element = e.target;
    document.fullscreenElement ? document.exitFullscreen() : element.requestFullscreen().catch(console.error);
  };

  const endCall = () => {
    setIsCallEnded(true);
    socket.emit("terminateCall", { targetId: partnerUserId });
    peerConnectionRef.current?.destroy();
    window.location.reload();
  };

  const sendMessage = (text) => {
    const newMessage = { message: text, type: "sent", timestamp: Date.now(), sender: name };
    setChatMessages((prev) => [...prev, newMessage]);
    socket.emit("sendMessage", { targetId: partnerUserId, message: text, senderName: name });
  };

  return (
    <VideoCallContext.Provider
      value={{
        call,
        isCallAccepted,
        myVideoRef,
        partnerVideoRef,
        userStream,
        name,
        setName,
        isCallEnded,
        myUserId,
        callUser,
        endCall,
        receiveCall,
        sendMessage,
        receivedMessage,
        chatMessages,
        setChatMessages,
        setReceivedMessage,
        setPartnerUserId,
        opponentName,
        isMyVideoActive,
        toggleMedia,
        isPartnerVideoActive,
        isMyMicActive,
        isPartnerMicActive,
        isScreenSharing,
        toggleScreenSharingMode,
        toggleFullScreen,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
};

export { VideoCallContext, VideoCallProvider };
