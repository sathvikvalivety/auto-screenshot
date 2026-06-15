document.addEventListener('DOMContentLoaded', () => {
  const intervalInput = document.getElementById('interval');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const logDiv = document.getElementById('log');
  const previewImg = document.getElementById('preview');
  
  const video = document.getElementById('videoElement');
  const canvas = document.getElementById('canvasElement');

  let intervalId = null;
  let screenshotCount = 0;
  let currentStream = null;

  function log(msg) {
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  startBtn.addEventListener('click', () => {
    const intervalMins = parseFloat(intervalInput.value);
    
    if (isNaN(intervalMins) || intervalMins <= 0) {
      alert("Invalid interval.");
      return;
    }

    log(`Opening tab selector...`);
    
    chrome.desktopCapture.chooseDesktopMedia(['tab'], (streamId) => {
      if (!streamId) {
        log(`Selection cancelled.`);
        return;
      }

      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      intervalInput.disabled = true;
      screenshotCount = 0;

      log(`Got stream ID. Connecting to video...`);
      
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId
          }
        }
      }).then((stream) => {
        currentStream = stream;
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
          video.play();
          log(`Video stream connected. Resolution: ${video.videoWidth}x${video.videoHeight}`);
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          intervalId = setInterval(takeAndSaveScreenshot, intervalMins * 60 * 1000);
          log(`Started interval every ${intervalMins} minute(s).`);
          takeAndSaveScreenshot();
        };
      }).catch((err) => {
        log(`GetUserMedia error: ${err.message}`);
        stopCapture();
      });
    });
  });

  stopBtn.addEventListener('click', stopCapture);

  function stopCapture() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }
    
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    intervalInput.disabled = false;
    log(`Stopped capturing.`);
  }

  function takeAndSaveScreenshot() {
    if (!currentStream || !video.videoWidth) return;

    try {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/png');

      screenshotCount++;
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `auto_screenshot_${timestamp}_${screenshotCount.toString().padStart(4, '0')}.png`;

      chrome.downloads.download({
        url: dataUrl,
        filename: `auto_screenshots/${filename}`,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          log(`❌ File save error: ${chrome.runtime.lastError.message}`);
        } else {
          log(`✅ Saved: ${filename}`);
        }
      });

      previewImg.src = dataUrl;
      previewImg.style.display = 'block';

    } catch (e) {
      log(`❌ Frame extraction error: ${e.message}`);
    }
  }
});
