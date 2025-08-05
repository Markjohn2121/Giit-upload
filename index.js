require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const {
  GITHUB_TOKEN,
  GITHUB_USERNAME,
  GITHUB_REPO,
  GITHUB_BRANCH,
} = process.env;

const GITHUB_API = "https://api.github.com";
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

async function uploadToGitHub(path, contentBuffer) {
  const url = `${GITHUB_API}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;
  const contentBase64 = contentBuffer.toString("base64");

  // Check if file exists to get SHA
  let sha = null;
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    });
    sha = res.data.sha;
  } catch (e) {
    if (e.response?.status !== 404) {
      throw e;
    }
  }

  const uploadRes = await axios.put(
    url,
    {
      message: `Upload ${path}`,
      content: contentBase64,
      branch: GITHUB_BRANCH,
      ...(sha && { sha }),
    },
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return `${RAW_BASE}/${path}`;
}

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "GitHub File Upload Server is running" 
  });
});

// File upload endpoint
app.post("/upload", upload.fields([{ name: "file1" }, { name: "file2" }]), async (req, res) => {
  try {
    const folder = req.body.folder || "uploads";
    const results = {};
    
    if (req.files.file1) {
      const file1 = req.files.file1[0];
      const file1Path = `${folder}/${file1.originalname}`;
      results.file1URL = await uploadToGitHub(file1Path, file1.buffer);
    }
    
    if (req.files.file2) {
      const file2 = req.files.file2[0];
      const file2Path = `${folder}/${file2.originalname}`;
      results.file2URL = await uploadToGitHub(file2Path, file2.buffer);
    }
    
    // Validate at least one file was uploaded
    if (!req.files.file1 && !req.files.file2) {
      return res.status(400).json({ error: "At least one file is required" });
    }
    
    res.json({
      success: true,
      message: "Files uploaded successfully",
      ...results
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ 
      error: "Upload failed", 
      details: err.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
