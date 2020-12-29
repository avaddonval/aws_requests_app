//aws s3api create-bucket --bucket <FMI> --region us-west-2 --create-bucket-configuration LocationConstraint=us-west-2
const AWS = require('aws-sdk');
const config = require('config');
let credentials = new AWS.SharedIniFileCredentials({profile: config.get('project.profile')});
AWS.config.credentials = credentials;
AWS.config.update({region: config.get('project.region')});

const fs = require('fs');
const path = require('path');
const S3 = new AWS.S3();
const BUCKET_NAME = config.get('project.name')+'-bucket-for-requests';
async function deploy(){
  try{
    let existsBuckets = await S3.listBuckets().promise();
    let existsBucket = existsBuckets.Buckets.find(bucket=>bucket.Name===BUCKET_NAME)
    let s3Bucket
    if(!existsBucket){
      s3Bucket = await S3.createBucket({Bucket:BUCKET_NAME}).promise()
      let params = {
        Body: '[]', 
        Bucket: BUCKET_NAME, 
        Key: 'requests.json',
      };
      let requestsFile = await S3.putObject(params).promise();
      console.log('S3 done')
    }
    
  }catch(err){
    throw(err)
  }
}
async function destroy(){
  try{
    await S3.deleteObjects({
      Bucket:BUCKET_NAME,
      Delete:{
        Objects:[
          {Key:'requests.json'},
          {Key:'sendRequest.zip'},
          {Key:'getRequests.zip'},
        ]
      }
    }).promise()
    await S3.deleteBucket({Bucket:BUCKET_NAME}).promise()
  }catch(err){
    throw(err)
  }
  
}
module.exports = {
  deploy,
  destroy
}