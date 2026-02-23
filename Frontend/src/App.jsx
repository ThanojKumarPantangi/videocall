import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Copy, PhoneOff, Sun, Moon, Video, Focus } from "lucide-react";
import Peer from "simple-peer";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://videocall-ch8w.onrender.com", {
  transports: ["websocket"],
});

export default function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [name, setName] = useState("");
  const [isBlurred, setIsBlurred] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  // Track who we called so leaveCall can notify them
  const calledIdRef = useRef("");

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) myVideo.current.srcObject = currentStream;
      })
      .catch((err) => {
        console.error("Failed to get media devices:", err);
      });

    // Handles reconnects where socket ID may change
    socket.on("me", (id) => setMe(id));

    socket.on("callUser", ({ from, name: callerName, signal }) => {
      setReceivingCall(true);
      setCaller(from);
      setName(callerName);
      setCallerSignal(signal);
    });

    // Handle remote peer hanging up
    socket.on("callEnded", () => {
      setCallEnded(true);
      connectionRef.current?.destroy();
      window.location.reload();
    });

    return () => {
      socket.off("me");
      socket.off("callUser");
      socket.off("callEnded");
    };
  }, []);

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  };

  const callUser = (id) => {
    calledIdRef.current = id;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: ICE_SERVERS,
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name,
      });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
    });

    // Use socket.on + manual cleanup instead of socket.once to avoid missing the event
    const handleCallAccepted = (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
      socket.off("callAccepted", handleCallAccepted);
    };
    socket.on("callAccepted", handleCallAccepted);

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    calledIdRef.current = caller;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: ICE_SERVERS,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    // Notify the other peer we are leaving
    const partnerId = calledIdRef.current || caller;
    if (partnerId) {
      socket.emit("endCall", { to: partnerId });
    }
    connectionRef.current?.destroy();
    window.location.reload();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <div className={`app-wrapper ${isDarkMode ? "dark-theme" : "light-theme"}`}>
      <motion.div
        className="app-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* HEADER */}
        <motion.div className="header" variants={itemVariants}>
          <div className="logo">
            <Video size={28} className="logo-icon" />
            <h1>ConnectNow</h1>
          </div>
          <button
            className="icon-button theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </motion.div>

        <div className="main-content">
          {/* VIDEOS GRID */}
          <motion.div className="video-section" variants={itemVariants}>
            <AnimatePresence mode="popLayout">
              {stream && (
                <motion.div
                  className={`video-wrapper ${callAccepted && !callEnded ? "secondary" : "primary"}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout
                >
                  <span className="video-label">{name || "You"}</span>
                  <video
                    muted
                    playsInline
                    autoPlay
                    ref={myVideo}
                    className="video-element"
                    style={{ filter: isBlurred ? "blur(12px)" : "none" }}
                  />
                  <button
                    className="floating-btn blur-btn"
                    onClick={() => setIsBlurred(!isBlurred)}
                    title={isBlurred ? "Unblur Background" : "Blur Background"}
                  >
                    <Focus size={16} /> {isBlurred ? "Unblur" : "Blur"}
                  </button>
                </motion.div>
              )}

              {callAccepted && !callEnded && (
                <motion.div
                  className="video-wrapper primary"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 100 }}
                  layout
                >
                  <span className="video-label">Remote User</span>
                  <video playsInline autoPlay ref={userVideo} className="video-element" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* CONTROLS PANEL */}
          <motion.div className="controls-panel" variants={itemVariants}>
            <div className="panel-header">
              <h2>Meeting Details</h2>
              <p>Share your ID to invite others, or enter an ID to join.</p>
            </div>

            <div className="input-group">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Your ID</label>
              <div className="copy-box">
                <span className="id-text">{me || "Generating..."}</span>
                <button
                  className="icon-button"
                  onClick={() => navigator.clipboard.writeText(me)}
                  title="Copy ID"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            <div className="divider"></div>

            <div className="input-group">
              <label>Join a Call</label>
              <input
                type="text"
                placeholder="Paste ID to Call"
                value={idToCall}
                onChange={(e) => setIdToCall(e.target.value)}
              />
            </div>

            <div className="action-buttons">
              {callAccepted && !callEnded ? (
                <button className="btn-end-call" onClick={leaveCall}>
                  <PhoneOff size={20} /> End Call
                </button>
              ) : (
                <button className="btn-primary" onClick={() => callUser(idToCall)}>
                  <Phone size={20} /> Call Now
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* INCOMING CALL MODAL */}
        <AnimatePresence>
          {receivingCall && !callAccepted && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="caller-modal"
                initial={{ y: 50, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 50, scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.4 }}
              >
                <div className="caller-avatar">
                  <Phone size={32} className="ringing-icon" />
                </div>
                <div className="caller-info">
                  <h3>{name || "Someone"} is calling...</h3>
                  <p>Incoming video call</p>
                </div>
                <button className="btn-answer" onClick={answerCall}>
                  <Phone size={20} /> Answer Call
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}