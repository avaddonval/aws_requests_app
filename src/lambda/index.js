//aws s3api create-bucket --bucket <FMI> --region us-west-2 --create-bucket-configuration LocationConstraint=us-west-2
const AWS = require('aws-sdk');
const config = require('config');
let credentials = new AWS.SharedIniFileCredentials({profile: config.get('project.profile')});
AWS.config.credentials = credentials;
AWS.config.update({region: config.get('project.region')});
const iam = new AWS.IAM();
const LAMBDA = new AWS.Lambda();
const S3 = new AWS.S3();
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = config.get('project.name')+'-bucket-for-requests';
const ROLE_NAME = 'lambda-role-'+config.get('project.name');
const GET_REQUESTS_LAMBDA = 'get_requests'+config.get('project.name')
const SEND_REQUEST_LAMBDA = 'send_request'+config.get('project.name')
async function deploy(){
  let roleName = await getRoleName();
  console.log(roleName)
  if(!roleName){
    let lambdaRole = await iam.createRole({
      AssumeRolePolicyDocument: fs.readFileSync(path.join(__dirname,'./AssumeRolePolicyDocument.json')).toString(),
      RoleName: ROLE_NAME,
    }).promise();
    roleName = await getRoleName();
  }
  let checkPolicy = await iam.getRolePolicy({
    PolicyName: ROLE_NAME+'Policy', 
    RoleName: ROLE_NAME
  }).promise().catch(async err=>{
    if(err.code === 'NoSuchEntity'){
      let setPoLicy = await iam.putRolePolicy({
        PolicyDocument: fs.readFileSync(path.join(__dirname,'./role.json')).toString(),
        PolicyName: ROLE_NAME+'Policy', 
        RoleName: ROLE_NAME
      }).promise();
    }
    else throw err
  });
  
  console.log('policy set')
  let sendRequestObject = await S3.putObject({
    Body: fs.readFileSync(path.join(__dirname,'./sendRequest/sendRequest.zip')), 
    Bucket: BUCKET_NAME, 
    Key: 'sendRequest.zip',
  }).promise();
  console.log('sendRequest loaded')
  let getRequestsObject = await S3.putObject({
    Body: fs.readFileSync(path.join(__dirname,'./getRequests/getRequests.zip')), 
    Bucket: BUCKET_NAME, 
    Key: 'getRequests.zip',
  }).promise();
  console.log('getRequests loaded')
  let lambdaPost = await LAMBDA.getFunction({
    FunctionName: SEND_REQUEST_LAMBDA
  }).promise().catch(async err=>{
    if(err.code==='ResourceNotFoundException'){
      await LAMBDA.createFunction({
        Code: {
            S3Bucket: BUCKET_NAME, 
            S3Key: "sendRequest.zip"
        },
        Environment: {
          Variables: {
           "BUCKET": BUCKET_NAME, 
           "REGION": config.get('project.region')
          }
        },
        FunctionName: SEND_REQUEST_LAMBDA, 
        Handler: "index.handler",
        Publish: true, 
        Role: roleName, 
        Runtime: "nodejs10.x"
      }).promise();
      console.log('sendRequest lambda created')
    } else throw err
  })
      
  
  let lambdaGet = await LAMBDA.getFunction({
    FunctionName: GET_REQUESTS_LAMBDA
  }).promise().catch(async err=>{
    if(err.code==='ResourceNotFoundException'){
      await LAMBDA.createFunction({
        Code: {
            S3Bucket: BUCKET_NAME, 
            S3Key: "getRequests.zip"
        },
        Environment: {
          Variables: {
          "BUCKET": BUCKET_NAME, 
          "REGION": config.get('project.region')
          }
        },
        FunctionName: GET_REQUESTS_LAMBDA, 
        Handler: "index.handler",
        Publish: true, 
        Role: roleName, 
        Runtime: "nodejs10.x"
      }).promise();
      console.log('getRequests lambda created')
    } else throw err

  })
}
async function destroy(){
  let getFunc = await LAMBDA.deleteFunction({
    FunctionName: GET_REQUESTS_LAMBDA,
  }).promise().catch(err=>{console.log(err.code)});
  let sendFunc = await LAMBDA.deleteFunction({
    FunctionName: SEND_REQUEST_LAMBDA,
  }).promise().catch(err=>{console.log(err.code)});
  await iam.deleteRolePolicy({
    PolicyName: ROLE_NAME+'Policy', 
    RoleName: ROLE_NAME
  }).promise().catch(err=>{console.log(err.code)});
  let lambdaRole = await iam.deleteRole({
    RoleName: ROLE_NAME,
  }).promise().catch(err=>{console.log(err.code)});
  

}
module.exports = {
  deploy,
  destroy
}

async function getRoleName(){
  let ROLE_NAME_STR;
  var roles_arr = (await iam.listRoles().promise()).Roles;
  // console.log(roles_arr);
  for(var i_int = 0; i_int < roles_arr.length; i_int += 1){
      // console.log(roles_arr[i_int].Arn);
      if(roles_arr[i_int].RoleName === ROLE_NAME){
          ROLE_NAME_STR = roles_arr[i_int].Arn;
          break;
      }
  }
  return ROLE_NAME_STR
}