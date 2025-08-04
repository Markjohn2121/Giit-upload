require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");

const app = express();
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

app.post("/upload", upload.fields([{ name: "profileImage" }, { name: "coverImage" }]), async (req, res) => {
  try {
    const username = req.body.username;
    if (!username || !req.files.profileImage || !req.files.coverImage) {
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
    res.status(500).json({ error: "Upload failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
