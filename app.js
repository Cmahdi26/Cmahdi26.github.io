const form = document.getElementById("form");
const cameraInput = document.getElementById("cameraInput");
const libraryInput = document.getElementById("libraryInput");
const shotBtn = document.getElementById("shotBtn");
const libraryBtn = document.getElementById("libraryBtn");
const sendBtn = document.getElementById("sendBtn");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const nextUrl = document.getElementById("nextUrl");
const dateField = document.getElementById("dateField");
const deviceField = document.getElementById("deviceField");

nextUrl.value = new URL("success.html", window.location.href).href;
dateField.value = new Date().toLocaleString("fr-FR");
deviceField.value = navigator.userAgent.includes("iPhone")
  ? "iPhone"
  : navigator.userAgent;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function showPreview(file) {
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  placeholder.hidden = true;
  sendBtn.hidden = false;
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return file;
  }

  const maxSize = 1600;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], "ma-photo.jpg", { type: "image/jpeg" });
}

async function attachFile(file, autoSend) {
  if (!file) {
    return;
  }

  setStatus("Préparation de la photo…");
  shotBtn.disabled = true;
  libraryBtn.disabled = true;

  try {
    const ready = await compressImage(file);
    const transfer = new DataTransfer();
    transfer.items.add(ready);
    cameraInput.files = transfer.files;
    showPreview(ready);
    setStatus("Photo enregistrée. Envoi vers Gmail…");

    if (autoSend) {
      overlay.hidden = false;
      form.requestSubmit();
    }
  } catch (error) {
    setStatus("Impossible de préparer la photo. Réessayez.", true);
  } finally {
    shotBtn.disabled = false;
    libraryBtn.disabled = false;
  }
}

shotBtn.addEventListener("click", () => {
  cameraInput.value = "";
  cameraInput.click();
});

libraryBtn.addEventListener("click", () => {
  libraryInput.value = "";
  libraryInput.click();
});

cameraInput.addEventListener("change", () => {
  const file = cameraInput.files && cameraInput.files[0];
  attachFile(file, true);
});

libraryInput.addEventListener("change", () => {
  const file = libraryInput.files && libraryInput.files[0];
  attachFile(file, true);
});

form.addEventListener("submit", (event) => {
  if (!cameraInput.files || cameraInput.files.length === 0) {
    event.preventDefault();
    overlay.hidden = true;
    setStatus("Prenez d’abord une photo.", true);
    return;
  }
  overlay.hidden = false;
  dateField.value = new Date().toLocaleString("fr-FR");
});
