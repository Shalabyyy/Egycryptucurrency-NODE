const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const BlockChain = require("./blockchain");
const rp = require("request-promise");
const joi = require("joi");
const SHA256 = require("sha256");
const url = require('url')
const cors = require('cors')
const currency = new BlockChain();

const port = process.env.PORT || process.argv[2];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

//DISCLAIMER: This class represents a node

//PART ONE : HOME
//1- The Homepage
app.get("/", (req, res) => {
  //Change to Https
  const url = "https://" + req.headers.host
  currency.currentNodeUrl = url
  res.json({ hello: "Welome to Egycryptocurrency" });
});

//Disbanded
app.post("/", (req, res) => {
  //Change to Https
  const url = "https://" + req.headers.host
  currency.currentNodeUrl = url
  currency.publicAddress = req.body.publicAddress
  res.json({ hello: "Welome to Egycryptocurrency" });
});
app.get("/ping", (req, res) => {
  res.json({ ping: "pong" });
});

//2- This Method gets the current blockchain state
app.get("/blockchain", (req, res) => {
  const url = "https://" + req.headers.host
  const dataToShow = {
    currentNodeUrl: currency.currentNodeUrl,
    networkNodes: currency.networkNodes,
    publicAddress: currency.publicAddress,
    networkAddresses: currency.networkAddresses,
    balance: currency.balance,
    chain: currency.chain,
    pendingTransactions: currency.pendingTransactions,
    validatedTransactions: currency.validatedTransactions
  };
  return res.send(dataToShow);
});

//PART TWO: Transaction Creation

//3- this method will create a transaction with the given inputs and will procced to broadcast them
app.post("/transaction/broadcast", (req, res) => {
  //Validate Request Body
  const data = req.body;
  const schema = joi.object().keys({
    sender: joi.allow(), //change to 2 or 64 later
    recipient: joi.string().required(), //change to 64 later
    amount: joi
      .number()
      .min(0)
      .required(),
    thirdParty: joi.boolean().allow()
  });
  const valid = joi.validate(data, schema);
  if (valid.error !== null) {
    console.log(valid.error);
    return res.json({ error: `Invalid  ${valid.error}` });
  }
  //Starting Here The Inputs are Valid
  var newTransaction = "";
  if (req.body.thirdParty) {
    newTransaction = currency.createNewTransaction(
      req.body.sender,
      req.body.recipient,
      req.body.amount
    );
  } else {
    newTransaction = currency.createNewTransaction(
      currency.publicAddress,
      req.body.recipient,
      req.body.amount
    );
  }

  if (newTransaction === null) {
    console.log("Null transactions");
    return res.json({ error: "Insuffceient Funds" });
  }
  //Add to my own Array
  currency.addTransactionToPendingTransactions(newTransaction);
  //Broadcast to the rest of the Nodes
  const requestPromises = [];
  currency.networkNodes.forEach(networkNodeUrl => {
    console.log("Register Transaction at:" + networkNodeUrl);
    const requestOptions = {
      uri: networkNodeUrl + "/transaction",
      method: "POST",
      body: newTransaction,
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises).then(data => {
    res.json({ message: "The Broadcast was successfull" });
  });
});


//4-This method register a transaction
app.post("/transaction", (req, res) => {
  const newTransaction = req.body;
  const data = req.body;
  const schema = joi.object().keys({
    sender: joi.allow(), //change to 2 or 64 later
    recipient: joi.string().required(), //change to 64 later
    amount: joi
      .number()
      .min(0)
      .required(),
    transactionHash: joi.allow(),
    validationsNeeded: joi.allow()
  });
  const valid = joi.validate(data, schema);
  if (valid.error !== null) {
    console.log(valid.error);
    return res.json({ error: `Invalid  ${valid.error}` });
  }
  //Validated Data from here
  let message = "";
  if (req.body.sender == "00") {
    currency.addTransactionToValidTransactions(newTransaction);
  } else {
    message = currency.addTransactionToPendingTransactions(newTransaction);
  }
  return res.json({
    message: `The transaction will be added to block ${message}`
  });
});

//5- Used for development purposes, This method will deposit the given amount to thegiven address
app.post("/deposit", (req, res) => {
  //Validate Request Body
  const data = req.body;
  const schema = joi.object().keys({
    sender: joi.allow(), //change to 2 or 64 later
    recipient: joi.string().required(), //change to 64 later
    amount: joi
      .number()
      .min(0)
      .required()
  });
  const valid = joi.validate(data, schema);
  if (valid.error !== null) {
    console.log(valid.error);
    return res.json({ error: `Invalid  ${valid.error}` });
  }

  //Starting Here The Inputs are Valid
  const newTransaction = currency.createNewTransaction(
    "00",
    req.body.recipient,
    req.body.amount
  );
  //Add to my own Array, Later to have it's pwn validation
  currency.addTransactionToValidTransactions(newTransaction);
  //Broadcast to the rest of the Nodes
  const requestPromises = [];
  currency.networkNodes.forEach(networkNodeUrl => {
    console.log("Register Transaction at:" + networkNodeUrl);
    const requestOptions = {
      uri: networkNodeUrl + "/transaction",
      method: "POST",
      body: newTransaction,
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises).then(data => {
    res.json({
      message: "Successfuly Deposited and Broadcast was successfull"
    });
  });
});

//6- After the mining, This method will be executed for the miner to receive their award
app.post("/award-miner", (req, res) => {
  //Validate Request Body
  const data = req.body;
  const schema = joi.object().keys({
    sender: joi.allow(), //change to 2 or 64 later
    recipient: joi.string().required(), //change to 64 later
    amount: joi
      .number()
      .min(0)
      .required(),
    validationsNeeded: joi.allow()
  });
  const valid = joi.validate(data, schema);
  if (valid.error !== null) {
    console.log(valid.error);
    return res.json({ error: `Invalid  ${valid.error}` });
  }

  //Starting Here The Inputs are Valid
  const newTransaction = currency.createNewTransaction(
    // currency.publicAdress,
    req.body.sender,
    req.body.recipient,
    req.body.amount
  );
  //Add to my own Array
  currency.addTransactionToValidTransactions(newTransaction);
  //Broadcast to the rest of the Nodes
  const requestPromises = [];
  currency.networkNodes.forEach(networkNodeUrl => {
    console.log("Register Transaction at:" + networkNodeUrl);
    const requestOptions = {
      uri: networkNodeUrl + "/transaction",
      method: "POST",
      body: newTransaction,
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises).then(data => {
    res.json({ message: "The Broadcast was successfull" });
  });
});

//7- This methid wil allow the current node to approve or disapprove the current block
app.post("/receive-new-block", (req, res) => {
  const newBlock = req.body.newBlock;
  const schema = joi.object().keys({
    index: joi
      .number()
      .integer()
      .required(),
    timestamp: joi
      .number()
      .integer()
      .required(),
    transactions: joi.array().required(),
    nonce: joi
      .number()
      .integer()
      .required(),
    hash: joi
      .string()
      .length(64)
      .required(),
    previousBlockHash: joi.string().required(),
    merkleTreeRoot: joi.string().allow()
  });
  const validation = joi.validate(newBlock, schema);
  if (validation.error !== null) {
    console.log(validation.error);
    return res.json({ error: `invalid Input ${validation.error}` });
  }
  // console.log(newBlock);
  const lastBlock = currency.getLastBlock();
  const correctHash = lastBlock.hash === newBlock.previousBlockHash;
  const correctIndex = lastBlock.index + 1 == newBlock.index;
  //console.log(lastBlock.hash + " -" + newBlock.previousBlockHash);
  //console.log(lastBlock.index + 1);
  //console.log(newBlock.index);
  if (correctHash && correctIndex) {
    //accept
    currency.chain.push(newBlock);
    currency.validatedTransactions = [];
    console.log("Block Accepted");
    return res.json({
      message: "New Block received and accepeted",
      newBlock: newBlock
    });
  } else {
    //reject
    console.log("Block Rejected");
    return res.json({ message: "New Block Rejected", newBlock: newBlock });
  }
});

//8- This method is used update transactions to validated
app.post("/set-valid", (req, res) => {
  console.log("Hi There");
  const request = req.body.transaction;
  const valid = req.body.valid
  if (valid) {
    currency.pendingTransactions.forEach(transaction => {
      if (request.transactionHash == transaction.transactionHash) {
        const index = currency.pendingTransactions.indexOf(transaction);
        if (index == -1) {
          return res.json({ error: "The transaction was validatde" });
        }
        console.log(index);
        const newTransaction = currency.pendingTransactions[index];
        currency.pendingTransactions.splice(index, 1);
        currency.validatedTransactions.push(newTransaction);
      }
    });
  }
  else {
    console.log("LOLOLOLOLOLO")
    currency.pendingTransactions.forEach(transaction => {
      if (request.transactionHash == transaction.transactionHash) {
        const index = currency.pendingTransactions.indexOf(transaction);
        if (index == -1) {
          return res.json({ error: "The transaction was Removed" });
        }
        console.log(index);
        const newTransaction = currency.pendingTransactions[index];
        currency.pendingTransactions.splice(index, 1);
        console.log("YOU FXING FRAUD")
      }
    });
  }

  return res.json({ message: "Successsfuly updated Transaction Array" });
});

//9- This method  will validate a trasnaction and broadscast the result to all network nodes
app.post("/validate/transaction", (req, res) => {
  if (currency.pendingTransactions.length == 0) {
    return res.json({ error: "Nothing to Validate" });
  }
  const {
    amount,
    sender,
    recipient,
    transactionHash
  } = currency.pendingTransactions[0];
  console.log(currency.pendingTransactions[0]);
  const transactionSubj = currency.pendingTransactions[0];
  // console.log(`amount added will be ${amount}`);
  // const index = currency.pendingTransactions.indexOf(req.body);
  const index = 0;
  let valid = true;
  if (index == -1) {
    valid = false;
    return res.json({ error: "TERMINATED:The Transaction does not exist" });
  }
  //2- Checking Origin and Destination
  if (currency.publicAddress == sender) {
    currency.pendingTransactions.splice(index, 1);
    valid = false;
    //Later to add the recipient as well
  }
  //3- Checking Balance of The Sender in Blockchain and Validated Transactions
  let balance = currency.getAddressdata(sender).balance;
  currency.validatedTransactions.forEach(transaction => {
    if (transaction.sender == sender) balance = balance - transaction.amount;
    if (transaction.recipient == sender) balance = balance + transaction.amount;
  });
  if (balance < amount) {
    currency.pendingTransactions.splice(index, 1);
    valid = false;
  }
  //4- Check Hash
  const hashTest = SHA256(sender + amount.toString() + recipient);
  if (hashTest != transactionHash) {
    currency.pendingTransactions.splice(index, 1);
    valid = false;
  }

  //5- Return Valid Data, Updated Validated and Pending Transactions !!!! ASSUME ONLY 1 VALIDATION IS NEEDED
  if (valid) {
    console.log("Transaction Is tamam");
    currency.pendingTransactions.splice(index, 1); //Later To Broadcast the transaction
    currency.validatedTransactions.push(transactionSubj);
    const requestPromises = [];
    currency.networkNodes.forEach(nodeUrl => {
      console.log(`Checking at node ${nodeUrl}`);
      const requestOptions = {
        uri: nodeUrl + "/set-valid",
        method: "POST",
        body: { transaction: transactionSubj, valid: true },
        json: true
      };
      requestPromises.push(rp(requestOptions));
    });
    console.log("VOILA");
    Promise.all(requestPromises)
      .then(data => {
        return res.json({ message: "The transaction has been validated" });
      })
      .catch(err => console.log(err));
  } else {
    const requestPromises = [];
    currency.networkNodes.forEach(nodeUrl => {
      console.log(`Checking at node ${nodeUrl}`);
      const requestOptions = {
        uri: nodeUrl + "/set-valid",
        method: "POST",
        body: { transaction: transactionSubj, valid: false },
        json: true
      };
      requestPromises.push(rp(requestOptions));
    });
    console.log("VOILA");
    Promise.all(requestPromises)
      .then(data => {
        return res.json({ message: "The transaction has been Terminated" });
      })
      .catch(err => console.log(err));
  }
});

//10- This method allows the node to mine the current block
app.get("/mine", (req, res) => {
  //Get Previous hash

  const previousBlockhash = currency.getLastBlock().hash;

  //get unforged transactions
  const currentBlockData = {
    transactions: currency.validatedTransactions,
    index: currency.getLastBlock().index + 1
  };
  //execure proof of work and commute hash
  const nonce = currency.proofOfWork(previousBlockhash, currentBlockData);
  const hash = currency.hashBlock(previousBlockhash, currentBlockData, nonce);
  const newBlock = currency.createNewBlock(nonce, previousBlockhash, hash);
  //reward Miner

  const requestPromises = [];
  currency.networkNodes.forEach(nodeUrl => {
    const requestOptions = {
      uri: nodeUrl + "/receive-new-block",
      method: "POST",
      body: { newBlock: newBlock },
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises)
    .then(data => {
      //Award Miner
      const requestOptions = {
        uri: currency.currentNodeUrl + "/award-miner",
        method: "POST",
        body: {
          amount: parseFloat(currency.getMiningReward()),
          sender: "00",
          recipient: currency.publicAddress
        },
        json: true
      };
      return rp(requestOptions);
    })
    .then(data => {
      return res.json({
        message: "New block mined and broadcasted successfuly",
        block: newBlock
      });
    });
});

//Network Functions

//11- Add a node to the network and broadcast
app.post("/register-and-broadcast-node", (req, res) => {
  try {
    const data = req.body;
    const schema = joi.object().keys({
      newNodeUrl: joi.string().required(),
      publicAddress: joi.allow()
    });
    const valid = joi.validate(data, schema);
    if (valid.error !== null) {
      console.log(valid.error);
      return res.json({ error: `Invalid Data ${valid.error}` });
    }

    //Validation is Fine
    const nodeUrl = req.body.newNodeUrl;
    const newPA = req.body.publicAddress
    var nodeAddress = "-1";
    //Check if it is not in the network
    if (currency.networkNodes.indexOf(nodeUrl) == -1) {
      //Add The Address and IP of the new node
      currency.networkNodes.push(nodeUrl);
      const requestOptions = {
        uri: nodeUrl + "/blockchain",
        method: "GET",
        json: true
      };
      rp(requestOptions)
        .then(response => {
          nodeAddress = response.publicAddress;
          if (nodeAddress == "-1") console.log("Bollocks");
          if (
            nodeAddress != "-1" &&
            currency.networkAddresses.indexOf(response.publicAddress) == -1 &&
            currency.publicAddress != nodeAddress
          ) {
            console.log(nodeAddress);
            currency.networkAddresses.push(response.publicAddress);
          } else {
            return res.json({ error: "Address Already Exists" });
          }
        })
        .then(cnt => {
          const regNodesPromises = []; //to make sure all requests send back replies
          currency.networkNodes.forEach(networkNodeUrl => {
            const requestOptions = {
              uri: networkNodeUrl + "/register-node",
              method: "POST",
              body: { newNodeUrl: nodeUrl, newNodeAddress: nodeAddress },
              json: true
            };
            regNodesPromises.push(rp(requestOptions));
          });
          Promise.all(regNodesPromises) //Once Finished with no errors, then ..
            .then(data => {
              //Now we have to send the new node, the rest of the nodes in the Network by calling register-nodes-bulk
              console.log("Successfuly Broadcasted");
              const bulkOptions = {
                uri: nodeUrl + "/register-nodes-bulk",
                method: "POST",
                body: {
                  allNetworkNodes: [
                    ...currency.networkNodes,
                    currency.currentNodeUrl
                  ],
                  allNetworkAddresses: [
                    ...currency.networkAddresses,
                    currency.publicAddress
                  ],
                  publicAddress: newPA
                },
                json: true
              };
              return rp(bulkOptions);
            })
            .then(data => {

              res.json({
                message: "Node successfuly registred in the netowrk"
              });
            })
            .catch(err => console.log(err));
        });
    } else {
      return res.json({ error: "The Node Already Exists" });
    }

    //Broadcast new Node to all Nodes in the Network by calling register-node
  } catch (error) {
    console.log(error);
  }
});

//12- Register a Single Node
app.post("/register-node", (req, res) => {
  try {
    const data = req.body;
    const schema = joi.object().keys({
      newNodeUrl: joi.string().required(),
      newNodeAddress: joi.string().required()
    });
    const valid = joi.validate(data, schema);
    if (valid.error !== null) {
      console.log(valid.error);
      return res.json({ error: `Invalid Data ${valid.error}` });
    }
    //Valid from here
    const newNodeUrl = req.body.newNodeUrl;
    const newNodeAddress = req.body.newNodeAddress;

    if (newNodeAddress == -1) console.log("La2 ma a7a ba2a register-node");
    else console.log("Gamed Ya Box");
    //Make Sure that the nodes is not me and It is not already in my array
    const notAlreadyThere = currency.networkNodes.indexOf(newNodeUrl) == -1;
    const notMe = currency.currentNodeUrl != newNodeUrl;
    if (notAlreadyThere && notMe) {
      currency.networkNodes.push(newNodeUrl);
      currency.networkAddresses.push(newNodeAddress);
      res.json({ message: "We have registered the new node" });
    } else {
      res.json({ message: "Error Registering the Node" });
    }
  } catch (error) {
    console.log(error);
  }
});

//13- Register an Array of Nodes
app.post("/register-nodes-bulk", (req, res) => {
  try {
    const data = req.body;
    const schema = joi.object().keys({
      allNetworkNodes: joi.array().required(),
      allNetworkAddresses: joi.array().required(),
      publicAddress: joi.allow()
    });
    const valid = joi.validate(data, schema);
    if (valid.error !== null) {
      console.log(valid.error);
      return res.json({ error: `Invalid Data ${valid.error}` });
    }
    //Valid from here
    const allNetworkNodes = req.body.allNetworkNodes;
    const allNetworkAddresses = req.body.allNetworkAddresses;

    if (allNetworkAddresses.indexOf("-1") != -1)
      console.log("La2 ma a7a ba2a register-BULK");
    else console.log("Gamed Ya Box");

    allNetworkNodes.forEach(networkNodeUrl => {
      if (
        currency.networkNodes.indexOf(networkNodeUrl) == -1 &&
        currency.currentNodeUrl != networkNodeUrl
      ) {
        //if Not Present, Register That Node and it's not my address
        if (networkNodeUrl != null && networkNodeUrl != undefined) {
          console.log(networkNodeUrl);
          currency.networkNodes.push(networkNodeUrl);
        }
      }
    });
    allNetworkAddresses.forEach(address => {
      if (
        currency.networkAddresses.indexOf(address) == -1 &&
        currency.publicAddress != address
      ) {
        if (address != null && address != undefined) {
          console.log(address); 
          currency.networkAddresses.push(address);
        }
      }
    });
    currency.publicAddress = req.body.publicAddress  
    console.log("hagat kter")
    const requestOptions = {
      uri: currency.currentNodeUrl + "/consensus",
      method: "GET",
      json: true
    };
    rp(requestOptions).then(data => {
      return res.json({ message: "Successfuly added All Nodes" });
    });
  } catch (error) {
    console.log(error);
  }
});

//14- Achieve consensus with the network
app.get("/consensus", (req, res) => {
  //Longest Chain Method
  const requestPromises = [];
  //Fetchiing All Blockchain Data
  if (currency.networkNodes.length === 0) {
    return res.json({ error: "You are The only Node in the network" });
  }
  currency.networkNodes.forEach(nodeUrl => {
    const requestOptions = {
      uri: nodeUrl + "/blockchain",
      method: "GET",
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  //Checking if there is a longer chain in the network
  Promise.all(requestPromises).then(blockchains => {
    const curretChainLength = currency.chain.length;
    let maxChainLength = curretChainLength;
    let longestChain = null;
    let newPendingTransactions = null;
    let newValidatedTransactions = null;
    blockchains.forEach(blockchain => {
      if (blockchain.chain.length > maxChainLength) {
        maxChainLength = blockchain.chain.length;
        longestChain = blockchain.chain;
        newPendingTransactions = blockchain.pendingTransactions;
        newValidatedTransactions = blockchain.validatedTransactions;
        console.log("Bigger Length");
      }
    });
    if (
      !longestChain ||
      (longestChain && !currency.chainIsValid(longestChain))
    ) {
      //console.log(currency.chainIsValid(longestChain))
      res.json({
        message: "Blockchain was not replaced",
        chain: currency.chain
      });
    } else if (longestChain && currency.chainIsValid(longestChain)) {
      currency.chain = longestChain;
      currency.pendingTransactions = newPendingTransactions;
      currency.validatedTransactions = newValidatedTransactions;
      res.json({
        message: "Blockchain was replaced with a longer one",
        chain: currency.chain
      });
    }
  });
});

//Getter Functions

//15- Get Block
app.get("/block/:blockhash", (req, res) => {
  const block = currency.getBlock(req.params.blockhash);
  res.json({ block: block });
});

//16- Get Transaction
app.get("/transaction/:transactionId", (req, res) => {
  const transaction = currency.getTransaction(req.params.transactionId);
  res.json({ transaction: transaction });
});

//17- Get Balance
app.get("/address/:address", (req, res) => {
  const transactions = currency.getAddressdata(req.params.address);
  res.json({ result: transactions });
});

//Disbanded
app.get("/block-explorer", function (req, res) {
  res.sendFile("./block-explorer/index.html", { root: __dirname });
});

//Registering new Wallets (OPTIONAL). This part is Left onlt to show progress
app.post("/add-address", (req, res) => {
  currency.addPublicAddress(req.body.address);
  return res.json({
    message: `Successfuly Added The Address ${req.body.address}`
  });
});
app.post("/add-address-broadcast", (req, res) => {
  const address = req.body.address;
  if (currency.networkAddresses.indexOf(address) != -1) {
    return res.json({ error: "Address Already Exists" });
  }
  currency.addPublicAddress(address);
  const requestPromises = [];
  currency.networkNodes.forEach(nodeUrl => {
    const requestOptions = {
      uri: nodeUrl + "/add-address",
      method: "POST",
      body: { address: address },
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises)
    .then(res.json({ message: "Successfully broadcasted new Address" }))
    .catch(error => res.json({ error: error }));
});


//Malware Detection

//18- This function will request a node to be removed
app.patch("/remove-node", (req, res) => {
  const nodeToBeDeleted = req.body.nodeToBeDeleted;
  //For Consistency Purposes We wont remove the address
  let index = currency.networkNodes.indexOf(nodeToBeDeleted);
  if (index !== -1) {
    currency.networkNodes.splice(index, 1);
    return res.json({ message: "Node Was successfuly deleted" });
  } else return res.json({ error: "Failed to delete Node" });
});

//19- This function willl remove the current node from the network
app.delete("/disconnect", (req, res) => {
  const requestPromises = [];
  currency.networkNodes.forEach(nodeUrl => {
    const requestOptions = {
      uri: nodeUrl + "/remove-node",
      method: "PATCH",
      body: { nodeToBeDeleted: currency.currentNodeUrl },
      json: true
    };
    requestPromises.push(rp(requestOptions));
  });
  Promise.all(requestPromises).then(data => {
    currency.flushBlockChain();
    //Remove Node URI from othe Nodes
    res.json({ message: "Successfuly cleared the blockchain" });
  });
});

//20- This method is used in the network controller classs
app.get("/testME", (req, res) => {
  res.json({ message: "I Have The Same Code" })
})

//21 - This endpoint shows the current mining reward
app.get("/reward", (req, res) => {
  const amount = currency.getMiningReward();
  console.log(`The amount OUT is ${amount}`)
  res.json({ message: amount })
})
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
