const form = document.getElementById("form");
const cameraInput = document.getElementById("cameraInput");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const placeholderText = document.getElementById("placeholderText");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const nextUrl = document.getElementById("nextUrl");
const dateField = document.getElementById("dateField");
const deviceField = document.getElementById("deviceField");
const live = document.getElementById("live");
const flash = document.getElementById("flash");

let stream = null;
let capturing = false;

nextUrl.value = new URL("success.html", window.location.href).href;
dateField.value = new Date().toLocaleString("fr-FR");
deviceField.value = navigator.userAgent.includes("iPhone")
  ? "iPhone"
  : navigator.userAgent;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  if (placeholderText) {
    placeholderText.textContent = message;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopCamera() {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  live.srcObject = null;
}

function showPreview(file) {
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  live.hidden = true;
  placeholder.hidden = true;
}

async function attachFile(file) {
  if (!file) {
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  cameraInput.files = transfer.files;
  showPreview(file);
  overlay.hidden = false;
  dateField.value = new Date().toLocaleString("fr-FR");
  form.requestSubmit();
}

async function waitForVideo() {
  if (live.videoWidth > 0) {
    return;
  }
  await Promise.race([
    new Promise((resolve) => {
      live.addEventListener("loadeddata", resolve, { once: true });
    }),
    delay(2500),
  ]);
}

async function snapAndSend() {
  if (capturing) {
    return;
  }
  capturing = true;

  flash.hidden = false;
  flash.classList.add("on");
  await delay(80);

  const canvas = document.createElement("canvas");
  canvas.width = live.videoWidth || 1280;
  canvas.height = live.videoHeight || 1280;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(live, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });

  stopCamera();
  flash.classList.remove("on");
  flash.hidden = true;

  if (!blob) {
    capturing = false;
    setStatus("Impossible de capturer la photo.", true);
    return;
  }

  const file = new File([blob], "ma-photo.jpg", { type: "image/jpeg" });
  setStatus("Photo prise. Envoi vers Gmail…");
  await attachFile(file);
}

async function startCamera() {
  setStatus("Ouverture de la caméra…");
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    },
  });

  live.srcObject = stream;
  live.hidden = false;
  placeholder.hidden = true;
  await live.play();
  await waitForVideo();
  setStatus("Photo automatique…");
  await delay(700);
  await snapAndSend();
}

async function boot() {
  try {
    await startCamera();
  } catch (error) {
    setStatus("Touche l’écran : la photo part ensuite toute seule.");
    placeholderText.textContent = "Touche l’écran pour lancer";
    const onTap = async () => {
      document.body.removeEventListener("pointerdown", onTap);
      try {
        await startCamera();
      } catch (tapError) {
        setStatus("Autorise la caméra dans Safari, puis recharge la page.", true);
      }
    };
    document.body.addEventListener("pointerdown", onTap, { once: true });
  }
}

form.addEventListener("submit", (event) => {
  if (!cameraInput.files || cameraInput.files.length === 0) {
    event.preventDefault();
    overlay.hidden = true;
    setStatus("La photo n’est pas prête.", true);
    capturing = false;
    return;
  }
  overlay.hidden = false;
});

boot();
