const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const rp = require("request-promise");
const requestIp = require('request-ip');
const port = process.env.PORT || 4002;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(requestIp.mw())


app.get('/',(req,res)=>{
    const ip = req.clientIp;
    console.log(ip)
    res.json({hello:ip})
    

})
app.get( '/get',(req,res)=>{
    res.json({message:"Successful"})
})
app.listen(port, () => {
    console.log(`Handler running on port ${port}`); 
  });