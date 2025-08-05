require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors"); // Added for CORS support

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json

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
  res.status(200).json({ status: "OK", message: "Server is running" });
});

app.post("/upload", upload.fields([{ name: "profileImage" }, { name: "coverImage" }]), async (req, res) => {
  try {
    const username = req.body.username;
    if (!username || !req.files?.profileImage || !req.files?.coverImage) {
      return res.status(400).json({ error: "Missing fields or files" });
    }

    const folder = `profiles/${username}`;
    const profileBuffer = req.files.profileImage[0].buffer;
    const profileName = req.files.profileImage[0].originalname;
    const coverBuffer = req.files.coverImage[0].buffer;
    const coverName = req.files.coverImage[0].originalname;

    const profilePath = `${folder}/${profileName}`;
    const coverPath = `${folder}/${coverName}`;

    const profileURL = await uploadToGitHub(profilePath, profileBuffer);
    const coverURL = await uploadToGitHub(coverPath, coverBuffer);

    res.json({
      profileURL,
      coverURL,
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
