require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { BlobServiceClient, StorageSharedKeyCredential, QueueServiceClient } = require("@azure/storage-blob");

const app = express();
app.use(cors());
app.use(express.json());

const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_BLOB_CONTAINER_NAME = "event-photos";
const QUEUE_NAME = "photo-processing";

// Initialize Azure Storage Clients
const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY);
const blobServiceClient = new BlobServiceClient(`https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential);
const queueServiceClient = new QueueServiceClient(`https://${AZURE_STORAGE_ACCOUNT_NAME}.queue.core.windows.net`, sharedKeyCredential);

// **Generate SAS Token for Secure Blob Upload**
app.get("/generate-sas", async (req, res) => {
    try {
        const containerClient = blobServiceClient.getContainerClient(AZURE_BLOB_CONTAINER_NAME);
        const blobName = req.query.filename;
        const blobClient = containerClient.getBlockBlobClient(blobName);

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 1); // 1-hour expiry

        const sasToken = await blobClient.generateSasUrl({
            permissions: "cw", // Allow create/write
            expiresOn: expiryDate
        });

        res.json({ uploadUrl: sasToken, blobUrl: blobClient.url });
    } catch (error) {
        console.error("Error generating SAS token:", error);
        res.status(500).json({ error: "Failed to generate SAS token" });
    }
});

// **Add Image to Queue for Processing**
app.post("/queue", async (req, res) => {
    try {
        const queueClient = queueServiceClient.getQueueClient(QUEUE_NAME);
        await queueClient.sendMessage(Buffer.from(req.body.blobUrl).toString("base64"));

        res.json({ success: true });
    } catch (error) {
        console.error("Error adding to queue:", error);
        res.status(500).json({ error: "Failed to add message to queue" });
    }
});

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));
