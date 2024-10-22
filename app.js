document
  .getElementById("uploadPic")
  .addEventListener("change", handleFileSelect);
document.getElementById("capturePic").addEventListener("click", capturePhoto);
document.getElementById("retakePic").addEventListener("click", retakePicture);
document.getElementById("deletePic").addEventListener("click", deletePicture);
document.getElementById("nextBtn").addEventListener("click", uploadImageToS3);

const MAX_FILE_SIZE_MB = 5 * 1024 * 1024; // 5MB
let selectedFile = null;

// File Upload Handler
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE_MB) {
    alert("File exceeds 5MB size limit");
    resetUI();
    return;
  }
  selectedFile = file;
  previewImage(URL.createObjectURL(file));
  showControls({ delete: true, next: true });
}

// Camera capture (this works in mobile browser)
function capturePhoto() {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      setTimeout(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 640; // Set to desired width
        canvas.height = 480; // Set to desired height
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        video.pause();
        stream.getTracks()[0].stop();

        canvas.toBlob((blob) => {
          if (blob.size > MAX_FILE_SIZE_MB) {
            alert("Captured photo exceeds 5MB size limit");
            resetUI();
            return;
          }
          selectedFile = blob;
          previewImage(URL.createObjectURL(blob));
          showControls({ retake: true, next: true });
        }, "image/jpeg");
      }, 3000); // Capture after 3 seconds
    })
    .catch((err) => {
      alert("Error accessing camera: " + err);
    });
}

// Image preview function
function previewImage(imageSrc) {
  const imgPreview = document.getElementById("imagePreview");
  imgPreview.src = imageSrc;
  imgPreview.style.display = "block";
  hideElement("progressContainer"); // Hide progress bar
  hideElement("result"); // Hide the result section if visible
}

// Retake picture function
function retakePicture() {
  resetUI();
}

// Delete picture function
function deletePicture() {
  resetUI();
}

// Reset UI function
function resetUI() {
  selectedFile = null;
  document.getElementById("uploadPic").value = ""; // Reset file input
  document.getElementById("imagePreview").style.display = "none"; // Hide image preview
  showControls({});
  hideElement("progressContainer"); // Ensure progress section is hidden
  hideElement("result"); // Ensure result section is hidden
}

// Upload Image to S3
function uploadImageToS3() {
  if (!selectedFile) {
    alert("No image selected!");
    return;
  }

  AWS.config.update({
    accessKeyId: "YOUR_ACCESS_KEY_ID", // Replace with your actual access key
    secretAccessKey: "YOUR_SECRET_ACCESS_KEY", // Replace with your actual secret key
    region: "us-east-1",
  });

  const s3 = new AWS.S3();
  const params = {
    Bucket: "my-rek-image",
    Key: `uploads/${Date.now()}_${selectedFile.name || "captured_photo.jpg"}`,
    Body: selectedFile,
    ContentType: selectedFile.type || "image/jpeg",
  };

  showElement("progressContainer"); // Show progress bar

  s3.upload(params)
    .on("httpUploadProgress", (evt) => {
      const progress = Math.round((evt.loaded / evt.total) * 100);
      document.getElementById("progressBar").value = progress;
    })
    .send((err, data) => {
      if (err) {
        alert("Error uploading file: " + err.message);
        hideElement("progressContainer"); // Ensure progress bar is hidden on error
        return;
      }
      hideElement("progressContainer"); // Hide progress bar after successful upload
      showElement("result"); // Show result section after successful upload
      console.log("Upload successful:", data);
    });
}

// Show or hide controls based on the current state
function showControls({ retake = false, delete: del = false, next = false }) {
  document.getElementById("retakePic").style.display = retake
    ? "block"
    : "none";
  document.getElementById("deletePic").style.display = del ? "block" : "none";
  document.getElementById("nextBtn").style.display = next ? "block" : "none";
}

// Helper functions to show/hide elements
function showElement(elementId) {
  document.getElementById(elementId).style.display = "block";
}

function hideElement(elementId) {
  document.getElementById(elementId).style.display = "none";
}
