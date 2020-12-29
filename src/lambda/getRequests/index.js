// # Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// #
// # Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except
// # in compliance with the License. A copy of the License is located at
// #
// # https://aws.amazon.com/apache-2-0/
// #
// # or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS,
// # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// # specific language governing permissions and limitations under the License.

let AWS = require('aws-sdk');

const s3 = new AWS.S3({
  region: process.env.REGION
});

const OBJECT_NAME = 'requests.json';
const BUCKET_NAME = process.env.BUCKET

exports.handler =  function(event, context, callback) {
    getRequests(event,callback);
}

async function getRequests(event, callback) {
   let data = getRequestsFromS3(event, callback);
}


function getRequestsFromS3(event, callback) {
  let expression = "select s.* from S3Object[*][*] s"        
  s3.selectObjectContent({
     Bucket: BUCKET_NAME,
     Expression: expression,
     ExpressionType: 'SQL',
     Key: OBJECT_NAME,
     InputSerialization: {
       JSON: {
         Type: 'DOCUMENT',
       }
     },
     OutputSerialization: {
       JSON: {
         RecordDelimiter: ','
       }
     }
   }, function(err, data) {
     if (err) {
         console.log(err);
     } else {
       return handleData(data, callback);
     }
   }
  );
}

function handleData(data, callback) {
    let event = data.Payload;
    let dataToReturn='';
    
    event.on('data', function(event) {
      if (event.Records) {
        dataToReturn += event.Records.Payload.toString();
      }
    });
		
	event.on("end", function() { 
    if(dataToReturn.slice(-1)===',') dataToReturn = dataToReturn.substring(0, dataToReturn.length - 1);
    dataToReturn = '['+dataToReturn+']';
    dataToReturn = JSON.parse(dataToReturn)
		callback(null,dataToReturn)
  });		
}