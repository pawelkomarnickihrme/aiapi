const express = require("express");
const axios = require("axios");

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

app.post("/api/perplexity", async (req, res) => {
  try {
    // Example data structure
    const data = {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: "Be precise and concise.",
        },
        {
          role: "user",
          content: "How many stars are there in our galaxy?",
        },
      ],
    };

    // Make a POST request to the external API
    const response = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      data,
      {
        headers: {
          Accept: "application/json",
          Authorization:
            "Bearer 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",
          "Content-Type": "application/json",
        },
      }
    );

    // Send the response from the external API back to the client
    res.json(response.data);
  } catch (error) {
    console.error("Error making request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
