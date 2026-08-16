const mongoose = require('mongoose');

const carSchema = mongoose.Schema({
    Brand: {
        type: String,
        required: true
    },
    Model: {
        type: String,
        required: true
    },
    Variant: {
        type: String,
        required: true
    },
    Body_type: {
        type: String,
        required: true
    },
    Reg_year: {
        type: String,
        required: true
    },
    KM: {
        type: String,
        required: true
    },
    Fuel_type: {
        type: String,
        required: true
    },
    Transmission: {
        type: String,
        required: true
    },
    Seating_capacity: {
        type: String
    },
    Owner_type: {
        type: String,
        required: true
    },
    Engine_capacity: {
        type: String,
        required: true
    },
    Max_power: {
        type: String,
        required: true
    },
    City: {
        type: String
    },
    Area: {
        type: String
    },
    Expected_price: {
        type: String,
        required: true
    },

    // Main/front image shown on CarCard
    image: String,
    imagePublicId: String,

    images: [
        {
            url: String,
            publicId: String
        }
    ],

    Owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    }
});

const Car = mongoose.model('car', carSchema);

module.exports = Car;