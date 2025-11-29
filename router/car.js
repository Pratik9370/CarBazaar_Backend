const express = require('express')
const Car_model = require('../models/Car')
const User_model = require('../models/User')
const authenticateUser = require('../middleware/authenticateUser')
const upload = require('../config/Multer')
const router = express.Router()

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

router.post('/showCarDetails', (req, res) => {
    const { car_id } = req.body
})


module.exports = router;