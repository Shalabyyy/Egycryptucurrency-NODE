const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const joi = require("joi");
const SHA256 = require("sha256");
const rp = require("request-promise");
const jwt = require("jsonwebtoken");
const path = require("path");
const cors = require("cors");
const Wallet = require("./WalletAddress");
const keys = require("../config/keys");

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = process.env.PORT || 4000;

mongoose.connect(keys.mongoUri, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
});
mongoose.connection
  .once("open", function() {
    console.log("Connection was Made With Wallet!");
  })
  .on("error", function(error) {
    console.log("Error is: ", error);
  });

//API METHODS
app.post("/register", async (req, res) => {
  const schema = joi.object().keys({
    password: joi
      .string()
      .min(8)
      .lowercase()
      .uppercase({ force: true })
      .required(),
    passwordConfirmation: joi
      .string()
      .min(8)
      .lowercase()
      .uppercase({ force: true })
      .required()
  });
  const validate = joi.validate(req.body, schema);
  if (validate.error !== null) {
    console.log(validate.error);
    return res.json({ error: `Invalid  ${validate.error}` });
  }
  if (req.body.password !== req.body.passwordConfirmation) {
    return res.json({ error: "Passwords Do not Match" });
  }
  const privateAddress = SHA256(Date.now().toString() + req.body.password);
  const publicAddress = SHA256(SHA256(privateAddress));

  const user = new Wallet({
    privateAddress: privateAddress,
    publicAddress: publicAddress,
    password: SHA256(req.body.password),
    nodeUrl:""
  })
    .save()
    .then(wallet =>
      res.json({
        data: {
          account: wallet,
          message:
            "THE PRIVATE ADDRESS IS YOU RESPONSBILTY PLEASE KEEP IT SOMEWHERE SECURE AND SAFE"
        }
      })
    )
    .catch(error => res.json({ error: error.message }));
});
app.post("/login", async (req, res) => {
  const schema = joi.object().keys({
    privateAddress: joi
      .string()
      .length(64)
      .required()
      .hex(),
    password: joi.string().required()
  });
  const validate = joi.validate(req.body, schema);
  if (validate.error !== null) {
    console.log(validate.error);
    return res.json({ error: `Invalid  ${validate.error}` });
  }
  const account = await Wallet.find({
    privateAddress: req.body.privateAddress
  });
  if (
    account !== undefined &&
    SHA256(req.body.password) === account[0].password
  ) {
    console.log("Correct Password");
    var token = jwt.sign(
      {
        _id: account[0]._id,
        publicAddress: account[0].publicAddress,
        privateAddress: account[0].privateAddress
      },
      keys.tokenSecret,
      { expiresIn: 21600 }
    );

    return res.json({
      message: "Successfully Logged In",
      account: account,
      token: token
    });
  } else {
    console.log("Wrong Password");
    console.log(account);
    return res.json({ error: "Wrong Private Address or Password" });
  }
});

app.post("/send-funds", (req, res) => {
  var token = req.headers["x-access-token"];
  //console.log(req.headers)
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  var publicAddress = "";
  jwt.verify(token, keys.tokenSecret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token." });
    console.log(decoded);
    publicAddress = decoded.publicAddress;
  });
  const schema = joi.object().keys({
    amount: joi
      .number()
      .min(0)
      .required(),
    recipient: joi
      .string()
      .length(64)
      .required()
  });
  const validate = joi.validate(req.body, schema);
  if (validate.error !== null) {
    console.log(validate.error);
    return res.json({ error: `Invalid  ${validate.error}` });
  }
  const nodeNumber = (Math.floor(Math.random() * Math.floor(4)) + 1).toString();
  const requestOptions = {
    uri: `https://egycryptocurrency-node-${nodeNumber}.herokuapp.com/transaction/broadcast`,
    method: "POST",
    body: {
      sender: publicAddress,
      recipient: req.body.recipient,
      amount: req.body.amount,
      thirdParty: true
    },
    json: true
  };
  rp(requestOptions)
    .then(data => res.json({ message: data }))
    .catch(error => res.json({ error: error }));
});

app.get("/get-balance", (req, res) => {
  var token = req.headers["x-access-token"];
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  var publicAddress = "";
  jwt.verify(token, keys.tokenSecret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token." });
    publicAddress = decoded.publicAddress;
  });
  console.log(publicAddress);
  const nodeNumber = (Math.floor(Math.random() * Math.floor(4)) + 1).toString();
  const requestOptions = {
    uri: `https://egycryptocurrency-node-${nodeNumber}.herokuapp.com/address/${publicAddress}`,
    method: "GET",
    json: true
  };
  rp(requestOptions)
    .then(data => res.json({ message: data }))
    .catch(error => res.json({ error: error }));
});

app.get("/logout", function(req, res) {
  res.status(200).send({ auth: false, token: null });
});

app.patch("/fix-link", async (req, res) => {
  var token = req.headers["x-access-token"];
  var publicAddress = "";
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  jwt.verify(token, keys.tokenSecret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token." });
    publicAddress = decoded.publicAddress;
  });
  var newUrl = req.body.newNodeUrl;
  if (newUrl.includes("https://")) {
    const update = await Wallet.findOneAndUpdate(
      { publicAddress: publicAddress },
      { nodeUrl: newUrl }
    );
    res.json({ update: update });
  } else return res.status(401).json({ error: "Can not Add the new Url" });
});

app.get("/get-node-link", async (req, res) => {
  var token = req.headers["x-access-token"];
  var publicAddress = "";
  if (!token)
    return res.status(401).send({ auth: false, message: "No token provided." });
  jwt.verify(token, keys.tokenSecret, function(err, decoded) {
    if (err)
      return res
        .status(500)
        .send({ auth: false, message: "Failed to authenticate token." });
    publicAddress = decoded.publicAddress;
  });
  const result = await Wallet.find({ publicAddress: publicAddress });
  return res.json({ nodeUrl: result });
});
app.use(express.static("wallet-client/build"));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "wallet-client", "build", "index.html"));
});

app.listen(port, () => {
  console.log(`Wallet running on port ${port}`);
});
