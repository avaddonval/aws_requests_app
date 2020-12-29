
var AWS = require("aws-sdk");

const s3 = new AWS.S3({
    region: process.env.REGION
});

const OBJECT_NAME = 'requests.json';
const BUCKET_NAME = process.env.BUCKET
exports.handler =  function(event, context, callback) {

  sendRequest(event,callback);
  
}

async function sendRequest(event, callback) {
  
   var data = await addRequestData(event);
   writeToS3(data, callback);
   
}



async function addRequestData(event) {
    var objectParams = {
        Bucket: BUCKET_NAME,
        Key: OBJECT_NAME
    };

    var jsonData='';
    var promise = await s3.getObject(objectParams).promise();
    jsonData = JSON.parse(promise.Body.toString()); 
    jsonData.push(event);
    return  jsonData;
}

function writeToS3(data, callback) {
    
    var uploadParams = {
        Bucket: BUCKET_NAME, 
        Key: OBJECT_NAME, 
        Body: JSON.stringify(data, null, '\t')
    }

    s3.upload(uploadParams, function (err, data) {
        if (data) {
           callback(null, 'OK')
        }
        if(err) {
            callback("Error" + err.message)
        }
    })

}
   

