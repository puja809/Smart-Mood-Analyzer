// Handle file upload and camera capture
document
	.getElementById("uploadPic")
	.addEventListener("change", handleFileSelect);
document.getElementById("capturePic").addEventListener("click", capturePhoto);
document.getElementById("retakePic").addEventListener("click", retakePicture);
document.getElementById("deletePic").addEventListener("click", deletePicture);
document.getElementById("nextBtn").addEventListener("click", uploadToS3);
document.getElementById("retryBtn").addEventListener("click", reloadPage);

const MAX_FILE_SIZE_MB = 5 * 1024 * 1024; // 5MB
let selectedFile = null;

// File Upload Handler
// ()=>uploadFile(param1, param2)

// Update File Upload Handler
function handleFileSelect(event) {
	const file = event.target.files[0];
	if (!file) return;
	if (file.size > MAX_FILE_SIZE_MB) {
		alert("File exceeds 5MB size limit");
		return;
	}
	selectedFile = file; // Assign selected file to global variable
	document.getElementById("actions").style.display = "none";
	previewImage(URL.createObjectURL(file));
	showControls({ delete: true, next: true });
}

// Use selectedFile directly in uploadToS3
async function uploadToS3() {
	if (!selectedFile) {
		alert("No file selected for upload.");
		return;
	}

	AWS.config.update({
		accessKeyId: AWS_ACCESS_KEY,
		secretAccessKey: AWS_SECRET_KEY,
		region: "us-east-1",
	});

	const s3 = new AWS.S3();
	const params = {
		Bucket: "my-rek-image",
		Key: `uploads/${Date.now()}_${selectedFile.name || "image.jpg"}`, // Default to image.jpg if name is missing
		Body: selectedFile,
		ContentType: selectedFile.type || "image/jpeg", // Default to image/jpeg if type is missing
	};

	// Show progress bar
	document.getElementById("preview-actions").style.display = "none";
	document.getElementById("progressContainer").style.display = "block";
	document.getElementById("retakePic").style.display = "none";
	document.getElementById("deletePic").style.display = "none";
	document.getElementById("nextBtn").style.display = "none";
	// Upload to S3 with progress tracking
	await s3
		.upload(params)
		.on("httpUploadProgress", (evt) => {
			// -5 is added because we have to wait for gemini AI response.
			const progress = Math.round((evt.loaded / evt.total) * 100) - 5;
			document.getElementById("progressBar").value = progress;
		})
		.send((err, data) => {
			if (err) {
				alert("Error uploading file: " + err.message);
				return;
			}
			console.log("Upload successful:", data);
			fetchFileFromS3("my-rek-image-parsed-data", selectedFile.name); // Pass selectedFile.name to fetchFileFromS3
		});
}

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
					if (!selectedFile?.name) {
						selectedFile.name = `${Date.now()}_image.${
							selectedFile?.type?.split("/").pop() ?? "jpeg"
						}`;
					}
					document.getElementById("actions").style.display = "none";
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
	//  resetUI();
	capturePhoto();
}

// Delete picture function
function deletePicture() {
	document.getElementById("actions").style.display = "block";
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
	document.getElementById("actions").style.display = "block";
}

// Gemini API Set
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyB7z4oqWtab9fkN0LXPTM7VuNOU0hDKrq0`;

// lets get generative answer
const generateAPIResponse = async (fileContent) => {
	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [
					{
						role: "user",
						parts: [{ text: fileContent }],
						//parts: [{text: xyz}]
					},
				],
			}),
		});

		const data = await response.json();
		console.log(data);
		const moodMessage = data.candidates[0].content.parts[0].text;
		document.getElementById("moodMessage").innerText = moodMessage;
		// Show the result section
		document.getElementById("progressBar").value = 100;
		document.getElementById("progressContainer").style.display = "none";
		document.getElementById("result").style.display = "block";
		document.getElementById("preview-actions").style.display = "flex";
		document.getElementById("retryBtn").style.display = "block";
	} catch (error) {
		console.log(error);
	}
};

// Function to fetch the file from S3 based on the picture name
async function fetchFileFromS3(bucketName, pictureName) {
	const s3 = new AWS.S3();

	// List objects in the bucket
	const params = {
		//Bucket: bucketName,
		Bucket: "my-rek-image-parsed-data",
	};
	await wait(10000);
	await s3.listObjectsV2(params, (error, data) => {
		if (error) {
			console.error("Error listing objects:", error);
			console.log(params);
			return;
		}

		// Use regex to find the matching file within a specific folder
		const folderPath = "face_details_analysis/uploads/";
		const regex = new RegExp(
			`^${folderPath}.*${pictureName?.split(".")[0]}.*\\.txt$`,
			"i"
		); // Match within folder and by base name
		const matchingFile = data.Contents.find((item) => regex.test(item.Key));

		if (matchingFile) {
			// Fetch the matching file
			const getObjectParams = {
				Bucket: bucketName,
				Key: matchingFile.Key,
			};

			s3.getObject(getObjectParams, (error, data) => {
				if (error) {
					console.error("Error fetching the file:", error);
				} else {
					const fileContent = data.Body.toString("utf-8");
					//console.log('File content:', fileContent);
					generateAPIResponse(fileContent);
				}
			});
		} else {
			console.log("No matching file found.");
		}
	});
}

async function wait(delay) {
	return new Promise((resolve) => setTimeout(resolve, delay));
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

function reloadPage() {
	location.reload();
}
