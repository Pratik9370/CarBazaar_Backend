const express = require('express')
const User_Model = require('../models/User')
const Car_model = require('../models/Car')
const jwt = require('jsonwebtoken')
const authenticateUser = require('../middleware/authenticateUser')
require('dotenv').config();
const redis = require("redis");
const crypto = require("crypto");
const geoip = require("geoip-lite");

const JWT_secret = process.env.JWT_SECRET_KEY

const accountSid = 'AC6ccb4a7e7f5a7a504136166a29a41702';
const authToken = '59f3ae39f3e47cb219b5b040fb298ae9';
const client = require('twilio')(accountSid, authToken);
const router = express.Router()

const RedisClient = redis.createClient({
    url: "redis://redis-13490.crce182.ap-south-1-1.ec2.redns.redis-cloud.com:13490",
    password: "yWyRMxvbUIbHzUs7N6CZMPo74JDjswGc"
});
RedisClient.on("error", (err) => console.log("Redis Error:", err));

(async () => {
    try {
        await RedisClient.connect();
        console.log("Redis connected");
    } catch (err) {
        console.error("Redis connection failed", err);
    }
})();

router.post('/sendOTP', async (req, res) => {

    const { mobile, username } = await req.body

    try {
        const OTPlen = 6
        const OTP = (0).toString();
        // const OTP = crypto.randomInt(10 ** (OTPlen - 1), 10 ** OTPlen).toString();
        await RedisClient.setEx(mobile, 300, OTP); // Store OTP with 5-minute expiry
        // client.messages
        //     .create({
        //         body: OTP,
        //         messagingServiceSid: 'MGcaaa81138a4036562691c0ace5404474',
        //         to: `+91${mobile}`
        //     })
        //     .then(message => console.log(message.sid));
        res.json({ message: `OTP sent is to ${mobile}` })
    } catch (err) {
        res.json({ err })
    }

})

router.post('/signup', async (req, res) => {
    try {
        const { name, mobile, otp } = req.body

        const user = await User_Model.findOne({ mobile })

        console.log(otp)

        if (!user) {
            try {
                const storedOTP = await RedisClient.get(mobile);
                if (String(otp) === String(storedOTP)) {
                    await User_Model.create({
                        name, mobile
                    })
                    const token = jwt.sign({ mobile }, JWT_secret);
                    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 })
                    res.json({ message: `Welcome ${name}` })
                }
                else {
                    res.json({ message: 'OTP is invalid' })
                }
            } catch (err) {
                console.log(err)
                res.status(500).json({ err })
            }
        }
        else if (user) {
            console.log('existed')
            res.status(200).json({ message: 'User with this mobile number already exist' })
        }
    } catch (err) {
        console.log(err)
        res.status(500).json({ err })
    }

})

router.post('/login', async (req, res) => {

    try {
        const { mobile, otp } = req.body

        try {
            const user = await User_Model.findOne({ mobile })

            if (user) {
                const storedOTP = await RedisClient.get(mobile);
                if (String(otp) === String(storedOTP)) {
                    const token = jwt.sign({ mobile }, JWT_secret)
                    await RedisClient.del(mobile); // Delete OTP after verification
                    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 })
                    res.json({ message: `Welcome back, ${user.name}` })
                }
                else {
                    res.json({ message: 'OTP is invalid' })
                }
            }
            else {
                res.status(200).json({ message: 'User with this mobile is not registered' })
            }
        } catch (err) {
            res.status(500).json({ err })
        }
    } catch (err) {
        res.status(500).json({ err })
    }
})

router.get(`/getUser`, authenticateUser, async (req, res) => {
    const mobile = req.user.mobile
    try {
        const user = await User_Model.findOne({ mobile }).populate('SavedCars').exec()
        const reg_cars = await Car_model.find({ Owner: user._id })
        const saved_cars = await user.SavedCars

        const key = `recent:cars:${user._id}`;
        const carIds = await RedisClient.lRange(key, 0, -1);
        const cars = await Car_model.find({ _id: { $in: carIds } });
        // Preserve order
        const carsMap = {};
        cars.forEach(car => carsMap[car._id] = car);
        const recentlyViewedCars = carIds.map(id => carsMap[id]).filter(Boolean);

        res.status(200).json({ user, reg_cars, saved_cars, recentlyViewedCars })
    } catch (err) {
        res.json(err)
    }
})

router.get("/getCarsInUserCity/:IP", async (req, res) => {
  try {
    const ip = req.params.IP;
    const geo = geoip.lookup(ip);

    if (!geo || !geo.city) {
      return res.status(200).json({
        City: null,
        cars_in_userCity: []
      });
    }

    const userCity = geo.city;

    const cars_in_userCity = await Car_model.find({ City: userCity }).collation({ locale: "en", strength: 2 });

    res.status(200).json({
      City: userCity,
      cars_in_userCity
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get('/verify', authenticateUser, (req, res) => {
    res.sendStatus(200);
});

module.exports = router; 