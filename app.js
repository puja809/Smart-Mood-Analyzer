// Handle file upload and camera capture
document.getElementById('uploadPic').addEventListener('change', handleFileSelect);
document.getElementById('capturePic').addEventListener('click', capturePhoto);

const MAX_FILE_SIZE_MB = 5 * 1024 * 1024; // 5MB

// File Upload Handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file.size > MAX_FILE_SIZE_MB) {
        alert('File exceeds 5MB size limit');
        return;
    }
    uploadToS3(file);
}

// Camera capture (this will work in a mobile browser)
function capturePhoto() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                video.pause();
                stream.getTracks()[0].stop();
                canvas.toBlob(blob => {
                    if (blob.size > MAX_FILE_SIZE_MB) {
                        alert('Captured photo exceeds 5MB size limit');
                        return;
                    }
                    uploadToS3(blob);
                }, 'image/jpeg');
            }, 3000); // Capture after 3 seconds
        })
        .catch(err => {
            alert('Error accessing camera: ' + err);
        });
}

// AWS S3 Upload function
function uploadToS3(file) {
    AWS.config.update({
        accessKeyId: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        secretAccessKey: 'x9mXI2fghejdoiu22847uGHJI*&^%RGIGHJKLkjhL',
        region: 'us-east-1'
    });

    const s3 = new AWS.S3();
    const params = {
        Bucket: 'my-rek-image',
        Key: `uploads/${Date.now()}_${file.name}`,
        Body: file,
        ContentType: file.type
    };

    // Show progress bar
    document.getElementById('progressContainer').style.display = 'block';

    s3.upload(params).on('httpUploadProgress', (evt) => {
        const progress = Math.round((evt.loaded / evt.total) * 100);
        document.getElementById('progressBar').value = progress;
    }).send((err, data) => {
        if (err) {
            alert('Error uploading file: ' + err.message);
            return;
        }
        // Hide progress bar and show result
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('result').style.display = 'block';
        console.log('Upload successful:', data);
    });
}
