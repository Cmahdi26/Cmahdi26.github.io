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
const photoUrl = document.getElementById("photoUrl");
const sizeField = document.getElementById("sizeField");
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

function putFileInInput(file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    cameraInput.files = transfer.files;
    return cameraInput.files && cameraInput.files.length > 0;
  } catch (error) {
    return false;
  }
}

async function compressJpeg(blob) {
  const bitmap = await createImageBitmap(blob);
  const maxSize = 1200;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const compressed = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.72);
  });

  return new File([compressed || blob], "TOUTOU.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function uploadTemp(file) {
  const attempts = [
    async () => {
      const body = new FormData();
      body.append("file", file, "TOUTOU.jpg");
      const res = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body,
      });
      const json = await res.json();
      const url = json && json.data && json.data.url;
      if (!url) {
        throw new Error("tmpfiles");
      }
      return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    },
    async () => {
      const body = new FormData();
      body.append("reqtype", "fileupload");
      body.append("time", "72h");
      body.append("fileToUpload", file, "TOUTOU.jpg");
      const res = await fetch(
        "https://litterbox.catbox.moe/resources/internals/api.php",
        { method: "POST", body }
      );
      const url = (await res.text()).trim();
      if (!url.startsWith("http")) {
        throw new Error("litterbox");
      }
      return url;
    },
  ];

  for (const attempt of attempts) {
    try {
      const url = await Promise.race([
        attempt(),
        delay(8000).then(() => {
          throw new Error("timeout");
        }),
      ]);
      if (url && url.startsWith("http")) {
        return url;
      }
    } catch (error) {
      // try next host
    }
  }
  return "";
}

async function sendPhoto(file) {
  overlay.hidden = false;
  dateField.value = new Date().toLocaleString("fr-FR");
  sizeField.value = `${file.size} octets`;
  showPreview(file);
  setStatus("Envoi de la photo vers Gmail…");

  putFileInInput(file);

  try {
    const hosted = await uploadTemp(file);
    if (hosted) {
      photoUrl.value = hosted;
    }
  } catch (error) {
    photoUrl.value = "";
  }

  if (!cameraInput.files || cameraInput.files.length === 0) {
    if (!photoUrl.value) {
      overlay.hidden = true;
      capturing = false;
      setStatus("Impossible de joindre la photo. Réessaie.", true);
      return;
    }
  }

  form.submit();
}

async function waitForVideo() {
  for (let i = 0; i < 15; i += 1) {
    if (live.videoWidth > 0 && live.videoHeight > 0) {
      return;
    }
    await delay(200);
  }
}

async function snapAndSend() {
  if (capturing) {
    return;
  }
  capturing = true;

  if (!live.videoWidth) {
    capturing = false;
    setStatus("Caméra pas prête. Touche l’écran.", true);
    return;
  }

  flash.hidden = false;
  flash.classList.add("on");
  await delay(80);

  const canvas = document.createElement("canvas");
  canvas.width = live.videoWidth;
  canvas.height = live.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(live, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });

  stopCamera();
  flash.classList.remove("on");
  flash.hidden = true;

  if (!blob || blob.size < 2000) {
    capturing = false;
    setStatus("Photo vide. Recharge la page.", true);
    return;
  }

  const file = await compressJpeg(blob);
  setStatus("Photo prise. Envoi vers Gmail…");
  await sendPhoto(file);
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

boot();
