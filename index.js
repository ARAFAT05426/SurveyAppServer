const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5426;
//MIDDLEWARE
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello NODE");
  });
// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
