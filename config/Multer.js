require("dotenv").config();
const multer  = require('multer')
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let resourceType = "image"; // default

    return {
      folder: "Cars",
      resource_type: resourceType,
      public_id: file.originalname.split(".")[0], // optional: keep original name
    };
  },
});

  
  const upload = multer({ storage: storage })
  module.exports=upload
