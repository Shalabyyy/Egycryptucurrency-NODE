const SHA256 = require("sha256");
const crypto = require("crypto");
const buffer = require("buffer");
const merkle = require("merkle");
const currentNodeUrl = getUrl();

function getUrl() {
  if (process.env.NODE_ENV === "production") {
    return "https://egycryptocurrency-node-1.herokuapp.com";
  } else {
    return process.argv[3];
  }
}
//Blockchain Constructor
function Blockchain() {
  this.currentNodeUrl = currentNodeUrl;
  this.networkNodes = [];
  this.chain = [];
  this.pendingTransactions = []; //Transaction Pool
  this.validatedTransactions = [];
  this.publicKey = null;
  this.privateKey = null;
  this.publicAddress = SHA256(SHA256(this.currentNodeUrl));
  this.networkAddresses = [];
  this.balance = 0.0;
  //Create Genisis Blocks
  this.createNewBlock(100, "0", "0");
  this.generateKeys();
}
//1- This method will be used after a block is mined, creating the block and adding it to the blockchain
Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
  const merkleTreeRoot = this.getMerkleRoot(this.validatedTransactions);
  const newBlock = {
    index: this.chain.length + 1,
    timestamp: Date.now(),
    transactions: this.validatedTransactions,
    nonce: nonce,
    hash: hash,
    previousBlockHash: previousBlockHash,
    merkleTreeRoot: merkleTreeRoot
  };
  this.validatedTransactions = []; //Clear Transactions
  this.chain.push(newBlock);

  return newBlock;
};

//2- This method gets the last (most recent) block in the blockchain
Blockchain.prototype.getLastBlock = function() {
  return this.chain[this.chain.length - 1];
};

//3- Given an input of  sender, recipient and an amount, This function will create an instance of a transaction
Blockchain.prototype.createNewTransaction = function(
  sender,
  recipient,
  amount
) {
  let validationsNeeded = 0;
  if (sender != "00") {
    validationsNeeded = 1;
  } else if (
    amount > this.getAddressdata(this.publicAddress).balance1 &&
    sender != "00"
  ) {
    console.log("insuffcient funds");
    return null;
  }
  const hash = SHA256(sender + amount.toString() + recipient);
  const newTransaction = {
    amount: amount,
    sender: sender,
    recipient: recipient,
    transactionHash: hash,
    validationsNeeded: validationsNeeded
  };
  return newTransaction;
};


//4- This function will add the given transaction to the pending trasnaction list
Blockchain.prototype.addTransactionToPendingTransactions = function(
  transaction
) {
  this.pendingTransactions.push(transaction);
  return this.chain.length;
};

//5- After validation, This function will add the given transaction to the validated trasnaction list
Blockchain.prototype.addTransactionToValidTransactions = function(transaction) {
  this.validatedTransactions.push(transaction);
};

//6- This method will be used in the Pow computation to hash a block
Blockchain.prototype.hashBlock = function(
  previousBlockHash,
  currentBlockData,
  nonce
) {
  const data =
    previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
  const hash = SHA256(data);
  return hash;
};

//7- This method will compute Pow
Blockchain.prototype.proofOfWork = function(
  previousBlockHash,
  currentBlockData
) {
  //Keep looping until the hash is found
  var nonce = 0;
  var hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
  var target = this.getMiningDifficulty()
  while (hash.substring(0, 4) !== target) {
    nonce++;
    hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
  }
  return nonce;
};

//8- This method will validate each block in the blockchain
Blockchain.prototype.chainIsValid = function(blockchain) {
  let validChain = true;
  //Validate Each block
  for (var i = 1; i < blockchain.length; i++) {
    const currentBlock = blockchain[i];
    const previousBlock = blockchain[i - 1];
    const currentBlockData = {
      transactions: currentBlock.transactions,
      index: currentBlock.index
    };
    const blockHash = this.hashBlock(
      currentBlock.previousBlockHash,
      currentBlockData,
      currentBlock.nonce
    );
    if (blockHash.substring(0, 4) !== this.getMiningDifficulty()) {
      console.log(currentBlock);
      console.log(
        `Invalid Block Hash Expected: ${currentBlock.hash}, Recieived: ${blockHash}`
      );
      validChain = false;
    }
    if (currentBlock.previousBlockHash !== previousBlock.hash) {
      console.log("Invalid Previous BlockHash");
      validChain = false;
    }
    if (
      currentBlock.merkleTreeRoot !=
      this.getMerkleRoot(currentBlock.transactions)
    ) {
      console.log("Invalid Merkle Root");
      validChain = false;
    }
  }
  //Validate Gensis Block
  const genisisBlock = blockchain[0];
  if (
    genisisBlock.index !== 1 ||
    genisisBlock.nonce !== 100 ||
    genisisBlock.hash != "0" ||
    genisisBlock.previousBlockHash != "0" ||
    genisisBlock.transactions.length !== 0
  ) {
    validChain = false;
  }
  return validChain;
};

//9- This method will take a blockhash and return it's data
Blockchain.prototype.getBlock = function(blockHash) {
  let resultBlock = null;
  this.chain.forEach(block => {
    if (block.hash == blockHash) resultBlock = block;
  });
  return resultBlock;
};

//10- This method will take a transaction id and return it's data
Blockchain.prototype.getTransaction = function(transactionId) {
  let resultTransaction = null;
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if (transaction.transactionHash == transactionId)
        resultTransaction = transaction;
    });
  });
  return resultTransaction;
};

//11- This method will calculate the balance of the inputed address
Blockchain.prototype.getAddressdata = function(address) {
  let transactionsMadeByAddress = [];
  var balance1 = 0;
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if (transaction.sender == address) {
        balance1 = balance1 - transaction.amount;
        transactionsMadeByAddress.push(transaction);
      }

      if (transaction.recipient == address) {
        balance1 = balance1 + transaction.amount;
        transactionsMadeByAddress.push(transaction);
      }
    });
  });
  this.validatedTransactions.forEach(transaction => {
    console.log(transaction.sender);
    if (transaction.sender == address) balance1 = balance1 - transaction.amount;
    if (transaction.recipient == address)
      balance1 = balance1 + transaction.amount;
  });
  const queryData = {
    transactions: transactionsMadeByAddress,
    balance: balance1
  };
  this.balance = queryData.balance;
  console.log(balance1);
  return queryData;
};

//12- This method is used to validate a transaction
Blockchain.prototype.validateTransaction = function(transaction) {
  const { amount, sender, recipient, transactionHash } = transaction;
  if (
    amount != undefined &&
    sender != undefined &&
    recipient != undefined &&
    transactionHash != undefined
  ) {
    console.log("Undefined Transaction");
    return false;
  }
  if (sender === this.publicAdress) {
    console.log("You can't validate your own transaction");
    return false;
  }
  const senderNode = null;
  const recipientNode = null;
  this.networkNodes.forEach(node => {});
};

//13- This method is used to generate public and private keys
Blockchain.prototype.generateKeys = function() {
  crypto.generateKeyPair(
    "rsa",
    {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: "spki",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
        cipher: "aes-256-cbc",
        passphrase: "top secret"
      }
    },
    (err, publicKey, privateKey) => {
      this.publicKey = publicKey;
      this.privateKey = privateKey;
      //console.log(this.publicKey)
    }
  );
};

//useless method
Blockchain.prototype.testEncryption = function(data) {
  const bufferedData = new Buffer(data);
  console.log(this.privateKey);
  const step1 = crypto.privateEncrypt(this.privateKey, bufferedData);
  console.log(step1);
  console.log("Encrypted with private key box");
  console.log();
  const step2 = crypto.publicDecrypt(this.publicKey, step1);
  console.log(step2);
  console.log("Decryption complete");
};

//14- This method is used to compute the merkle tree root
Blockchain.prototype.getMerkleRoot = function(transactions) {
  if (transactions.length == 0) {
    console.log("No Transactions");
    return;
  }
  var use_uppercase = false;
  merkle("sha256", use_uppercase).async(transactions, function(err, tree) {
    console.log(`Computer Tree Root ${tree.root()}`);
    return tree.root();
  });
};
//15- This method will reset the blockchain
Blockchain.prototype.flushBlockChain = function() {
  this.currentNodeUrl = currentNodeUrl;
  this.networkNodes = [];
  this.chain = [];
  this.pendingTransactions = []; //Transaction Pool
  this.validatedTransactions = [];
  this.publicKey = null;
  this.privateKey = null;
  this.publicAddress = SHA256(SHA256(this.currentNodeUrl));
  this.networkAddresses = [];
  this.balance1 = 0.0;
  //Execute Functions
  this.createNewBlock(100, "0", "0");
  this.generateKeys();
};

//useless method, but it adds a public address to the list
Blockchain.prototype.addPublicAddress = function(newAddress) {
  this.networkAddresses.push(newAddress);
};
//16- This method calculate how much coin has been exported from the coin reserve
Blockchain.prototype.getReserveExports = function() {
  let amount = 0;
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if (transaction.sender == "00") amount = amount + transaction.amount;
    });
  });
  this.validatedTransactions.forEach(transaction => {
    if (transaction.sender == "00") amount = amount + transaction.amount;
  });
  console.log(`The Net Amount is ${amount}`);
  return amount;
};
//17- This method calculates the mining reward
Blockchain.prototype.getMiningReward = function() {
  var amount = this.getReserveExports();
  if (amount < 10000) return 50;
  else if (amount <= 20000) return 25;
  else if (amount <= 30000) return 12.5;
  else if (amount <= 50000) return 6.25;
};
//18- This methgd calculates the mining reward
Blockchain.prototype.getMiningDifficulty = function(){
  var amount = this.getReserveExports();
  if (amount < 10000) return "0000";
  else if (amount <= 20000) return "0000";
  else if (amount <= 30000) return "00000";
  else if (amount <= 50000) return "000000";
  //Add new methods in code
}
Blockchain.prototype.selectBlock = function(blocks){
  const length = blocks.length
  //select a block randomly then validate

}
module.exports = Blockchain;
