const database = require("mongoose");
const dotenv = require("dotenv");
var cors = require("cors");
const express = require("express");
const http = require("http");
var cookieParser = require("cookie-parser");
const expressip = require("express-ip");

var path = require("path");
global.expressServerRoot = path.resolve(__dirname);

process.env["mongo_status"] = "OFF";

//initiate dotenv
dotenv.config();

let trackingObject = {};

database.connect(
  process.env.MONGO_URL,
  { useNewUrlParser: true, useUnifiedTopology: true },
  () => {
    console.log("connected to db...");
    process.env["mongo_status"] = "ON";
  }
);
database.connection.on("connected", function () {
  console.log("Mongoose default connection is open to ", process.env.MONGO_URL);
});

database.connection.on("error", function (err) {
  console.log("Mongoose default connection has occured " + err + " error");
});

database.connection.on("disconnected", function () {
  console.log("Mongoose default connection is disconnected");
});

process.on("SIGINT", function () {
  database.connection.close(function () {
    console.log(
      "Mongoose default connection is disconnected due to application termination"
    );
    process.exit(0);
  });
});

const expressServer = express();
const httpServer = http.createServer(expressServer);

//Middlewares body parser
expressServer.use(express.json({ limit: "10mb" }));
// need cookieParser middleware before we can do anything with cookies
expressServer.use(cookieParser());
// Client ip address finding middleware
expressServer.use(expressip().getIpInfoMiddleware);
expressServer.use(cors());

//route middlewares

expressServer.get("/messages", async (req, res) => {
    let array = database.Collection
})


httpServer.listen(8000, (err) => {
  if (err) {
    console.log("Server ERR :: ", err);
    return;
  }
  console.log("Server up and running on 8000");
});
