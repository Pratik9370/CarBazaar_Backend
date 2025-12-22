const express = require('express')
const Car_model = require('../models/Car')
const User_model = require('../models/User')
const authenticateUser = require('../middleware/authenticateUser')
const upload = require('../config/Multer')
const redis = require("redis");
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

router.post('/registerCar', authenticateUser, upload.single('image'), async (req, res) => {
    const { Brand, Model, Variant, Body_type, Reg_year, KM, Fuel_type, Transmission, Seating_capacity, Owner_type, City, Area, Expected_price } = req.body
    const user = await User_model.findOne({ mobile: req.user.mobile })
    try {
        const car = await Car_model.create({ Brand, Model, Variant, Body_type, Reg_year, KM, Fuel_type, Transmission, Seating_capacity, Owner_type, City, Area, Expected_price, Owner: user._id })
        await user.RegisteredCars.push(car._id)
        await user.save()
        if (req.file) {
            car.image = req.file.path; // Cloudinary URL
            car.imagePublicId = req.file.filename; // Public ID
            await car.save()
            console.log(car)
        }
        res.json({ message: 'Car registered' })

    } catch (err) {
        console.log(err)
        res.json({ message: err })
    }
})

router.post('/carList', async (req, res) => {

    const { price, fuel, body, transmission, brand, year, search } = req.body;

    const cars = await Car_model.find()

    // Convert numbers safely
    const maxPrice = Number(price) || Infinity;
    const maxYear = Number(year) || Infinity;

    const filteredCars = cars.filter((car) => {
        return (
            car.Expected_price <= maxPrice &&
            (fuel ? car.Fuel_type === fuel : true) &&
            (body ? car.Body_type.includes(body) : true) &&
            (transmission ? car.Transmission === transmission : true) &&
            (brand ? car.Brand === brand : true) &&
            car.Reg_year <= maxYear &&
            (search ? (car.Brand.toLowerCase().includes(search.toLowerCase()) || car.Model.toLowerCase().includes(search.toLowerCase())) : true)
        );
    });

    res.json({ filteredCars });
});

router.post('/saveCar', async (req, res) => {
    const { user_id, car_id } = req.body
    try {
        const user = await User_model.findOne({ _id: user_id })
        await user.SavedCars.push(car_id)
        await user.save()
        res.json({ message: 'saved' })
    } catch (err) {
        res.status(500).json(err)
    }
})

router.post('/unsaveCar', async (req, res) => {
    const { user_id, car_id } = req.body
    console.log(user_id, car_id)
    try {
        const user = await User_model.findOne({ _id: user_id })
        await user.SavedCars.pull(car_id)
        await user.save()
        res.json({ message: 'unsaved' })
    } catch (err) {
        res.status(500).json(err)
    }
})

router.post('/carSellerDetails', async (req, res) => {
    try {
        const { car_id } = req.body
        const car = await Car_model.findOne({ _id: car_id }).populate({ path: 'Owner', select: 'name mobile' })
        res.status(200).json({ name: car.Owner.name, mobile: car.Owner.mobile })
    }
    catch (err) {
        console.error(err)
    }
})

router.post('/recentlyViewedCars', authenticateUser, async (req, res) => {
    try {
        const car_id = req.body?.car_id;
        if (!car_id) {
            return res.status(400).json({ error: "car_id is required" });
        }

        const user = await User_model.findOne({ mobile: req.user.mobile });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const key = `recent:cars:${user._id}`;

        await RedisClient.sendCommand(['LREM', key, '0', car_id]);
        await RedisClient.sendCommand(['LPUSH', key, car_id]);
        await RedisClient.sendCommand(['LTRIM', key, '0', '9']);
        await RedisClient.sendCommand(['EXPIRE', key, '604800']);

        res.json({ success: true });

    } catch (err) {
        console.error("Redis recently viewed error:", err);
        res.status(500).json({ error: "Failed to update recently viewed cars" });
    }
});




module.exports = router;