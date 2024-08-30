const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const pplx = require("./api/apis/pplx/index.js");
require("dotenv").config();

// Import or define 'pplx' here
// Example: const pplx = require('perplexity-client'); // Replace with actual module

const app = express();
const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
app.use(express.json());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip;
  },
});
app.use("/api/", limiter);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "perplexity-service" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

app.post("/api/query", async (req, res) => {
  try {
    const { query } = req.body;
    const bookNameMatch = query.match(/Book Name:\s*([^,]+)/);
    const authorMatch = query.match(/Author:\s*([^,]+)/);
    const languageMatch = query.match(/Language:\s*([^,]+)/);
    console.log(
      "book name",
      bookNameMatch,
      "author",
      authorMatch,
      languageMatch
    );
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const cachedResponse = cache.get(query);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    pplx.auth(process.env.PERPLEXITY_API_KEY.replace(/^.*?(pplx-)/, "$1"));
    const perplexityResponse = await pplx.post_chat_completions({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: `You are tasked with writing book summaries in the ${languageMatch} language.`,
        },
        {
          role: "user",
          content: `Please provide a summary of the book "${bookNameMatch}" by ${authorMatch}. The summary should be concise, around 750 words, and formatted in MDX. Please do not include a main header for the text. The summary should be in ${languageMatch}, which is very important. Please ensure that the entire response is in ${languageMatch}.`,
        },
      ],
    });

    const responseData = perplexityResponse.data;
    cache.set(query, responseData);

    res.json(responseData);
  } catch (error) {
    logger.error("Error:", error);
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send("Something went wrong!");
});

app.listen(port, () => {
  console.log(`Perplexity proxy service running on port ${port}`);
});
