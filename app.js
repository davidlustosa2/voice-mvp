let pc = null;
let localStream = null;
let audioEl = null;
let dc = null;

const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

startBtn.addEventListener("click", startConversation);
stopBtn.addEventListener("click", stopConversation);

async function startConversation() {
  try {
    setStatus("Obtendo sessão...");

    const tokenResponse = await fetch("/api/session", {
      method: "POST"
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(err || "Falha ao obter sessão.");
    }

    const sessionData = await tokenResponse.json();
    const ephemeralKey =
      sessionData.client_secret?.value || sessionData.client_secret;

    if (!ephemeralKey) {
      throw new Error("client_secret não retornado pela API.");
    }

    setStatus("Pedindo acesso ao microfone...");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    setStatus("Criando conexão WebRTC...");
    pc = new RTCPeerConnection();

    audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);

    pc.ontrack = (event) => {
      audioEl.srcObject = event.streams[0];
    };

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
      console.log("Data channel aberto.");
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("Evento Realtime:", msg);
      } catch {
        console.log("Mensagem não JSON:", event.data);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    setStatus("Enviando oferta SDP para OpenAI...");

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-realtime-mini";

    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!sdpResponse.ok) {
      const errText = await sdpResponse.text();
      throw new Error(errText || "Falha ao negociar SDP.");
    }

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text()
    };

    await pc.setRemoteDescription(answer);

    setStatus("Conectado. Pode falar.");
  } catch (error) {
    console.error(error);
    setStatus(`Erro: ${error.message}`);
    stopConversation();
  }
}

function stopConversation() {
  if (dc) {
    dc.close();
    dc = null;
  }

  if (pc) {
    pc.close();
    pc = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
    audioEl = null;
  }

  setStatus("Conversa encerrada.");
}

function setStatus(text) {
  statusEl.textContent = text;
}
