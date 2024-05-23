{
const pcConfig = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' },] };
const mediaConstraints = { video: {width: 416, height: 416}, audio: false }
const connStatus = document.getElementById("status");

const setup_ws = () => {
  const ws = new WebSocket(`ws://${ip}:8829`);
  ws.onopen = _ => start_connection(ws);
  ws.onclose = event => {
    connStatus.innerHTML = "Connecting..."
    console.log("WebSocket connection was terminated:", event);
    setTimeout(setup_ws, 500)
  }
}
try { setup_ws(); } catch { e => setTimeout(setup_ws, 500)}

const start_connection = async (ws) => {
  const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  // document.getElementById("video").srcObject = localStream;
  const pc = new RTCPeerConnection(pcConfig);

  pc.onicecandidate = event => {
    if (event.candidate === null) return;
    console.log("Sent ICE candidate:", event.candidate);
    ws.send(JSON.stringify({ type: "ice_candidate", data: event.candidate }));
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState == "connected") {
      const button = document.createElement('button');
      button.innerHTML = "Disconnect";
      button.onclick = () => {
        ws.close();
        localStream.getTracks().forEach(track => track.stop())
      }
      connStatus.innerHTML = "Connected ";
      connStatus.appendChild(button);
    }
  }

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  ws.onmessage = async event => {
    const { type, data } = JSON.parse(event.data);

    switch (type) {
      case "sdp_answer":
        console.log("Received SDP answer:", data);
        await pc.setRemoteDescription(data);
        break;
      case "ice_candidate":
        console.log("Recieved ICE candidate:", data);
        await pc.addIceCandidate(data);
        break;
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log("Sent SDP offer:", offer)
  ws.send(JSON.stringify({ type: "sdp_offer", data: offer }));
};
}