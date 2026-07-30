(() => {
  "use strict";

  const ROOM_CODE_PATTERN = /^[A-F0-9]{8}$/;
  const roomCodeInput = document.querySelector("#roomCodeInput");
  const lobbyRoomCode = document.querySelector("#lobbyRoomCode");
  const qrContainer = document.querySelector("#lobbyQrCode");
  const scanner = document.querySelector("#qrScanner");
  const video = document.querySelector("#qrVideo");
  const scannerStatus = document.querySelector("#qrScannerStatus");
  const scanButton = document.querySelector("#scanRoomQr");
  const closeButton = document.querySelector("#closeQrScanner");
  const shareButton = document.querySelector("#shareRoomQr");
  let stream = null;
  let scanFrame = 0;
  let scanning = false;
  let detector = null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  function extractRoomCode(value) {
    const raw = String(value || "").trim();
    const direct = raw.toUpperCase();
    if (ROOM_CODE_PATTERN.test(direct)) return direct;
    try {
      const url = new URL(raw, location.href);
      const code = String(url.searchParams.get("room") || "").trim().toUpperCase();
      return ROOM_CODE_PATTERN.test(code) ? code : "";
    } catch {
      return "";
    }
  }

  function roomLink(code) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("room", code);
    return url.toString();
  }

  function renderQr() {
    if (!qrContainer || !lobbyRoomCode || typeof window.qrcode !== "function") return;
    const code = extractRoomCode(lobbyRoomCode.textContent);
    qrContainer.replaceChildren();
    if (!code) return;
    const qr = window.qrcode(0, "M");
    qr.addData(roomLink(code));
    qr.make();
    qrContainer.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
    const svg = qrContainer.querySelector("svg");
    if (svg) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `방 ${code} 참가 QR 코드`);
    }
  }

  function setScannerStatus(message, isError = false) {
    if (!scannerStatus) return;
    scannerStatus.textContent = message;
    scannerStatus.classList.toggle("error", isError);
  }

  function stopScanner() {
    scanning = false;
    cancelAnimationFrame(scanFrame);
    scanFrame = 0;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    if (scanner) {
      scanner.classList.add("hidden");
      scanner.hidden = true;
    }
  }

  function acceptScan(value) {
    const code = extractRoomCode(value);
    if (!code || !roomCodeInput) return false;
    roomCodeInput.value = code;
    roomCodeInput.dispatchEvent(new Event("input", { bubbles: true }));
    stopScanner();
    roomCodeInput.focus();
    const onlineMessage = document.querySelector("#onlineMessage");
    if (onlineMessage) {
      onlineMessage.textContent = `${code} 방을 찾았습니다. 닉네임을 확인하고 참가를 눌러 주세요.`;
      onlineMessage.style.color = "";
    }
    return true;
  }

  async function scanWithNativeDetector() {
    const results = await detector.detect(video);
    return results.find(result => acceptScan(result.rawValue));
  }

  function scanWithJsQr() {
    if (typeof window.jsQR !== "function" || !context || !video.videoWidth) return false;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = window.jsQR(image.data, image.width, image.height, {
      inversionAttempts: "attemptBoth"
    });
    return result ? acceptScan(result.data) : false;
  }

  async function scanLoop() {
    if (!scanning) return;
    try {
      const found = detector ? await scanWithNativeDetector() : scanWithJsQr();
      if (found || !scanning) return;
    } catch {
      detector = null;
      setScannerStatus("QR 코드를 화면 안에 맞춰 주세요.");
    }
    scanFrame = requestAnimationFrame(scanLoop);
  }

  async function startScanner() {
    if (!scanner || !video || scanning) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus("이 브라우저는 카메라를 지원하지 않습니다. 방 코드를 직접 입력해 주세요.", true);
      scanner.hidden = false;
      scanner.classList.remove("hidden");
      return;
    }
    scanner.hidden = false;
    scanner.classList.remove("hidden");
    setScannerStatus("카메라 권한을 허용해 주세요.");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      video.srcObject = stream;
      await video.play();
      detector = null;
      if ("BarcodeDetector" in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes("qr_code")) {
            detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          }
        } catch {
          detector = null;
        }
      }
      scanning = true;
      setScannerStatus("QR 코드를 네모 안에 맞춰 주세요.");
      scanLoop();
    } catch (error) {
      stopScanner();
      scanner.hidden = false;
      scanner.classList.remove("hidden");
      const denied = error?.name === "NotAllowedError";
      setScannerStatus(
        denied
          ? "카메라 권한이 거부되었습니다. 권한을 허용하거나 방 코드를 직접 입력해 주세요."
          : "카메라를 열 수 없습니다. 다른 앱이 카메라를 사용 중인지 확인해 주세요.",
        true
      );
    }
  }

  async function shareRoom() {
    const code = extractRoomCode(lobbyRoomCode?.textContent);
    if (!code) return;
    const url = roomLink(code);
    try {
      if (navigator.share) {
        await navigator.share({ title: "스도쿠 방 참가", text: `방 코드: ${code}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        const lobbyMessage = document.querySelector("#lobbyMessage");
        if (lobbyMessage) lobbyMessage.textContent = "방 참가 링크를 복사했습니다.";
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        const lobbyMessage = document.querySelector("#lobbyMessage");
        if (lobbyMessage) {
          lobbyMessage.textContent = "공유하지 못했습니다. 방 코드를 직접 복사해 주세요.";
          lobbyMessage.style.color = "var(--danger)";
        }
      }
    }
  }

  function applyDeepLink() {
    const url = new URL(location.href);
    const code = extractRoomCode(url.searchParams.get("room"));
    if (!code || !roomCodeInput) return;
    roomCodeInput.value = code;
    roomCodeInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#openMultiplayer")?.click();
    url.searchParams.delete("room");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const onlineMessage = document.querySelector("#onlineMessage");
    if (onlineMessage) onlineMessage.textContent = `${code} 방 코드가 입력되었습니다. 닉네임을 확인해 주세요.`;
  }

  if (lobbyRoomCode) {
    new MutationObserver(renderQr).observe(lobbyRoomCode, {
      childList: true,
      characterData: true,
      subtree: true
    });
    renderQr();
  }
  scanButton?.addEventListener("click", startScanner);
  closeButton?.addEventListener("click", stopScanner);
  shareButton?.addEventListener("click", shareRoom);
  scanner?.addEventListener("click", event => {
    if (event.target === scanner) stopScanner();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopScanner();
  });
  window.addEventListener("pagehide", stopScanner);
  applyDeepLink();
})();
