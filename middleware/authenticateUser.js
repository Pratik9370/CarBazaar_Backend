const jwt = require('jsonwebtoken')
require('dotenv').config();
const JWT_secret = process.env.JWT_SECRET_KEY

const authenticateUser = async (req,res,next)=>{
    const token = req.cookies['token']
    if(!token){
        return res.status(401).json({message:'Log in required'})
    }
    else{
        jwt.verify(token,JWT_secret, (err, user)=>{
            if(err){
                console.log(err)
                return res.sendStatus(403)
            }
            else{
                req.user=user
                next()
            }
        })
    }
}

module.exports = authenticateUser