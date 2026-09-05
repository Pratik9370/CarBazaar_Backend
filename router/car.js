const express = require('express')
const Car_model = require('../models/Car')
const User_model = require('../models/User')
const authenticateUser = require('../middleware/authenticateUser')
const upload = require('../config/Multer')
const cloudinary = require('../config/Multer').cloudinary
const redis = require("redis");
const router = express.Router()
const axios = require("axios");

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

router.post(
    '/registerCar',
    authenticateUser,
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'images', maxCount: 10 }
    ]),
    async (req, res) => {

        try {
            console.log("BODY:", req.body);
            console.log("FILES:", req.files);

            const {
                Brand,
                Model,
                Variant,
                Body_type,
                Reg_year,
                KM,
                Fuel_type,
                Transmission,
                Seating_capacity,
                Owner_type,
                Engine_capacity,
                Max_power,
                City,
                Area,
                Expected_price
            } = req.body;

            const user = await User_model.findOne({
                mobile: req.user.mobile
            });

            // Front image
            const frontImage = req.files.image?.[0];

            // Additional images
            const additionalImages = req.files.images || [];

            console.log("FRONT IMAGE:", frontImage);
            console.log("ADDITIONAL IMAGES:", additionalImages);

            const car = await Car_model.create({
                Brand,
                Model,
                Variant,
                Body_type,
                Reg_year,
                KM,
                Fuel_type,
                Transmission,
                Seating_capacity,
                Owner_type,
                Engine_capacity,
                Max_power,
                City,
                Area,
                Expected_price,

                // Front image
                image: frontImage?.path,
                imagePublicId: frontImage?.filename,

                // Additional images
                images: additionalImages.map((img) => ({
                    url: img.path,
                    publicId: img.filename
                })),

                Owner: user._id
            });

            user.RegisteredCars.push(car._id);
            await user.save();

            res.json({
                message: 'Car registered',
                car
            });

        } catch (err) {
            console.log(err);

            res.status(500).json({
                message: err.message
            });
        }
    }
);

router.post('/carList', async (req, res) => {

    const { price, fuel, body, transmission, brand, year, search, city } = req.body;

    const query = {};

    if (price) {
        query.$expr = {
            $lte: [
                { $toInt: "$Expected_price" },
                Number(price)
            ]
        };
    }
    if (fuel) query.Fuel_type = fuel;

    if (body) {
        if (body === "Utility Vehicles") {
            query.Body_type = { $in: ["SUV", "MUV/MPV", "Crossover"] };
        } else {
            query.Body_type = body;
        }
    }

    if (transmission) query.Transmission = transmission;
    if (brand) query.Brand = brand;
    if (year) query.Reg_year = { $gte: Number(year) };

    if (city) {
        query.City = { $regex: city, $options: "i" };
    }

    if (search) {
        query.$or = [
            { Brand: { $regex: search, $options: "i" } },
            { Model: { $regex: search, $options: "i" } },
        ];
    }

    const filteredCars = await Car_model.find(query);
    console.log(query, filteredCars)

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

router.delete('/deleteCar/:car_id', authenticateUser, async (req, res) => {
    try {
        const { car_id } = req.params;

        // Get logged-in user
        const user = await User_model.findOne({
            mobile: req.user.mobile
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Find car
        const car = await Car_model.findById(car_id);

        if (!car) {
            return res.status(404).json({
                message: "Car not found"
            });
        }

        // Check ownership
        if (car.Owner.toString() !== user._id.toString()) {
            return res.status(403).json({
                message: "You are not authorized to delete this car"
            });
        }

        // -----------------------------
        // Delete front image
        // -----------------------------

        if (car.imagePublicId) {
            await cloudinary.uploader.destroy(car.imagePublicId);
        }

        // -----------------------------
        // Delete additional images
        // -----------------------------

        if (car.images?.length) {
            await Promise.all(
                car.images.map(async (img) => {
                    if (img.publicId) {
                        await cloudinary.uploader.destroy(img.publicId);
                    }
                })
            );
        }

        // -----------------------------
        // Delete car document
        // -----------------------------

        await Car_model.findByIdAndDelete(car_id);

        // -----------------------------
        // Remove from owner's RegisteredCars
        // -----------------------------

        await User_model.findByIdAndUpdate(
            user._id,
            {
                $pull: {
                    RegisteredCars: car._id
                }
            }
        );

        // -----------------------------
        // Remove from everyone's SavedCars
        // -----------------------------

        await User_model.updateMany(
            {
                SavedCars: car._id
            },
            {
                $pull: {
                    SavedCars: car._id
                }
            }
        );

        res.status(200).json({
            message: "Car deleted successfully"
        });

    } catch (err) {
        console.error("Delete car error:", err);

        res.status(500).json({
            message: "Failed to delete car",
            error: err.message
        });
    }
});

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

router.post("/predict", async (req, res) => {
    try {

        const response = await axios.post(
            "https://carbazaar-ml-model.onrender.com/predict",
            req.body
        );

        const predictedPrice = response.data.predicted_price;

        let margin;

        if (predictedPrice < 500000) {
            margin = 0.08;
        } else if (predictedPrice < 1000000) {
            margin = 0.06;
        } else if (predictedPrice < 2000000) {
            margin = 0.05;
        } else {
            margin = 0.04;
        }

        const lowerBound = Math.round(predictedPrice * (1 - margin));
        const upperBound = Math.round(predictedPrice * (1 + margin));

        return res.status(200).json({
            success: true,
            priceRange: {
                lowerBound,
                upperBound
            }
        });

    } catch (error) {

        console.error(error.response?.data || error.message);

        return res.status(500).json({
            success: false,
            message: "Prediction failed"
        });
    }
});


module.exports = router;