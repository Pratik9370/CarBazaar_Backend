const mongoose = require('mongoose')
 require('dotenv').config();
const DB_URL = process.env.DB_URL

const connectToDB = ()=>{
    try{
        mongoose.connect(DB_URL);
        console.log('Connected to DB')
    }catch(err){
        console.error('DB connection failed: ',err)
    }
}

module.exports = connectToDB