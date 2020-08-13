const mongoose = require('mongoose')
const Schema = mongoose.Schema

const walletSchema = new Schema({
    privateAddress:{
        type:String,
        required:true,
        unique:true
    },
    publicAddress:{
        type: String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    nodeUrl:{
        type:String,
        required:false,
        unique:true
    },
})

module.exports = WalletAddress = mongoose.model('Wallet', walletSchema)