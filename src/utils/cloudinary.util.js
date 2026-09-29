const { PassThrough } = require("stream");

function uploadBufferToCloudinary(cloudinaryinstance, buffer, options = {}){
    return new Promise((resolve, reject) => {
        const passThrough = new PassThrough();

        const stream = cloudinaryinstance.uploader.upload_stream(options , (err, result) => {
            if(err)return reject(err);
            resolve(result);
        });

        passThrough.end(buffer);

        passThrough.pipe(stream);
    });
}

module.exports = { uploadBufferToCloudinary };