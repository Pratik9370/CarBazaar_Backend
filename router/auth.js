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
    const { mobile, username } = req.body;

    try {
        // Generate 6-digit OTP
        const OTPlen = 6;

        const OTP = crypto
            .randomInt(10 ** (OTPlen - 1), 10 ** OTPlen)
            .toString();

        // Store OTP in Redis for 5 minutes
        await RedisClient.setEx(mobile, 300, OTP);

        // Send OTP using TextBee
        const response = await fetch(
            'https://api.textbee.dev/api/v1/gateway/send-sms',
            {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.TEXTBEE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipients: [`+91${mobile}`],
                    message: `Your CarBazaar OTP is ${OTP}. It is valid for 5 minutes.`,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            throw new Error(
                error.error || `TextBee HTTP ${response.status}`
            );
        }

        const data = await response.json();

        console.log('TextBee response:', data);

        res.json({
            message: `OTP sent to ${mobile}`
        });

    } catch (err) {
        console.error('OTP error:', err);

        res.status(500).json({
            message: 'Failed to send OTP'
        });
    }
});



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
        const { mobile, otp } = req.body;

        const user = await User_Model.findOne({ mobile });

        if (!user) {
            return res.status(200).json({
                message: 'User with this mobile is not registered'
            });
        }

        // Developer login - does NOT consume TextBee/Redis OTP
        const isDeveloperLogin =
            process.env.DEV_OTP_BYPASS === 'true' &&
            String(mobile) === String(process.env.DEV_MOBILE) &&
            String(otp) === String(process.env.DEV_OTP);

        if (isDeveloperLogin) {
            const token = jwt.sign(
                { mobile },
                JWT_secret,
                { expiresIn: '24h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 24 * 60 * 60 * 1000
            });

            return res.json({
                message: `Developer login successful, ${user.name}`
            });
        }

        // Normal user OTP login
        const storedOTP = await RedisClient.get(mobile);

        if (String(otp) !== String(storedOTP)) {
            return res.status(401).json({
                message: 'OTP is invalid'
            });
        }

        // Delete OTP after successful verification
        await RedisClient.del(mobile);

        const token = jwt.sign(
            { mobile },
            JWT_secret,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.json({
            message: `Welcome back, ${user.name}`
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
});

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

router.post("/getCarsInUserCity", async (req, res) => {
    try {

        let detectedLocation = null;

        const { latitude, longitude } = req.body || {};

        // ===========================
        // GPS LOCATION
        // ===========================
        if (latitude && longitude) {

            const response = await fetch(
                `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${process.env.GEOAPIFY_API_KEY}`
            );

            if (!response.ok) {
                throw new Error("Geoapify API failed");
            }

            const data = await response.json();

            const properties = data.features[0]?.properties;

            let district =
                properties?.state_district ||
                properties?.county ||
                properties?.city ||
                null;

            if (district) {
                district = district.replace(/\s+District$/i, "");
            }

            console.log("District:", district);

            detectedLocation = district;

        }

        // ===========================
        // IP LOCATION (Fallback)
        // ===========================
        if (!detectedLocation) {

            let userIp =
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress;

            if (userIp?.includes(",")) {
                userIp = userIp.split(",")[0].trim();
            }

            if (userIp?.includes("::ffff:")) {
                userIp = userIp.replace("::ffff:", "");
            }

            const isLocal =
                userIp === "::1" ||
                userIp === "127.0.0.1";

            const queryIp = isLocal
                ? "152.58.33.95"
                : userIp;

            const response = await fetch(
                `http://ip-api.com/json/${queryIp}?fields=status,city,district,regionName`
            );

            const data = await response.json();
            console.log(data)

            if (data.status !== "fail") {
                detectedLocation =
                    data.district ||
                    data.city ||
                    data.regionName;
            }
        }

        const cars = detectedLocation
            ? await Car_model.find({
                $or: [
                    {
                        City: {
                            $regex: detectedLocation,
                            $options: "i",
                        },
                    },
                    {
                        District: {
                            $regex: detectedLocation,
                            $options: "i",
                        },
                    },
                ],
            })
            : [];

        res.json({
            City: detectedLocation,
            cars_in_userCity: cars,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            City: null,
            cars_in_userCity: [],
        });

    }
});

router.get('/verify', authenticateUser, (req, res) => {
    res.sendStatus(200);
});

router.post('/logout', authenticateUser, async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        });

        res.status(200).json({
            message: "Logged out successfully"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router; 