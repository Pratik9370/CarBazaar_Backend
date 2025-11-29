const express = require('express');
const cors = require('cors')
const connectToDB = require('./db')
const cookieParser = require('cookie-parser')


const app = express()

connectToDB()
  
  app.use(cors());

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', require('./router/auth'))
app.use('/api/car',require('./router/car'))

// const sql = require("mssql");

// const config = {
//     database: "PROJECT1",
//     server: "SUSHANT\\Susha",       // Example: DESKTOP-123ABC\SQLEXPRESS
//     driver: "SUSHANT\\Susha",
//     options: {
//         trustedConnection: true,
//     }
// };

// async function connectDB() {
//     try {
//         let pool = await sql.connect(config);
//         console.log("Connected to SQL Server!");

//         // Example Query
//         let result = await pool.request().query("SELECT TOP 10 * FROM YourTable");
//         console.log(result.recordset);

//     } catch (err) {
//         console.error("Database connection failed!", err);
//     }
// }

// connectDB();

app.get('/', (req, res) => {
    res.send("Server is listening")
})

app.listen(3000, () => {
    console.log('Server is listening')
})