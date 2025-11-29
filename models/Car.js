const mongoose = require('mongoose')
const { ContentCreateRequest } = require('twilio/lib/rest/content/v1/content')

const carSchema = mongoose.Schema({
    Brand:{
        type:String,
        required:true
    },
    Model:{
        type:String,
        required:true
    },
    Variant:{
        type:String,
        required:true
    },
    Body_type:{
        type:String,
        required:true
    },
    Reg_year:{
        type:String,
        required:true
    },
    KM:{
        type:String,
        required:true
    },
    Fuel_type:{
        type:String,
        required:true
    },
    Transmission:{
        type:String,
        required:true
    },
    Seating_capacity:{
        type:String,
    },
    Owner_type:{
        type:String,
        required:true
    },
    City:{
        type:String
    },
    Area:{
        type:String
    },
    Expected_price:{
        type:String,
        required:true
    },
    image:{
        type:String,
    },
    imagePublicId:{
        type:String
    },
    Owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user',
        required:true
    }
})

const Car = mongoose.model('car',carSchema)
module.exports = Car