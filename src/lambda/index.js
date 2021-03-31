//aws s3api create-bucket --bucket <FMI> --region us-west-2 --create-bucket-configuration LocationConstraint=us-west-2
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const config = require('config');
let credentials = new AWS.SharedIniFileCredentials({profile: config.get('project.profile')});
AWS.config.credentials = credentials;
AWS.config.update({region: config.get('project.region')});
const iam = new AWS.IAM();
const LAMBDA = new AWS.Lambda();
const S3 = new AWS.S3();

const pathes = {
  assumeRolePolicy: path.join(__dirname,'./AssumeRolePolicyDocument.json'),
  rolePolicy: path.join(__dirname,'./role.json'),
  sendRequestLambda: path.join(__dirname,'./sendRequest/sendRequest.zip'),
  getRequestsLambda: path.join(__dirname,'./getRequests/getRequests.zip')
}

const names = {
  bucketName: config.get('project.name')+'-bucket-for-requests',
  roleName: 'lambda-role-'+config.get('project.name'),
  getRequestsLambdaName: 'get_requests'+config.get('project.name'),
  sendRequestLambdaName: 'send_request'+config.get('project.name'),
  sendRequestS3Name: 'sendRequest.zip',
  getRequestsS3Name: 'getRequests.zip'
}
async function deploy(){
  await createRoleForLambda()
  await uploadLambdasToS3()
  await createLambdaFunctions()
}
async function destroy(){
  let getFunc = await LAMBDA.deleteFunction({
    FunctionName: names.getRequestsLambdaName,
  }).promise().catch(err=>{console.log(err.code)});
  let sendFunc = await LAMBDA.deleteFunction({
    FunctionName: names.sendRequestLambdaName,
  }).promise().catch(err=>{console.log(err.code)});
  await iam.deleteRolePolicy({
    PolicyName: names.roleName+'Policy', 
    RoleName: names.roleName
  }).promise().catch(err=>{console.log(err.code)});
  let lambdaRole = await iam.deleteRole({
    RoleName: names.roleName,
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
async function cretateIAMRole(){
  return await iam.createRole({
    AssumeRolePolicyDocument: fs.readFileSync(pathes.assumeRolePolicy).toString(),
    RoleName: names.roleName,
  }).promise();
}
async function createRolePolicy(){
  return await iam.putRolePolicy({
    PolicyDocument: fs.readFileSync(pathes.rolePolicy).toString(),
    PolicyName: names.roleName+'Policy', 
    RoleName: names.roleName
  }).promise();
}
async function createLambdaFunction(s3Key){
  return await LAMBDA.createFunction({
    Code: {
        S3Bucket: names.bucketName, 
        S3Key: s3Key
    },
    Environment: {
      Variables: {
       "BUCKET": names.bucketName, 
       "REGION": config.get('project.region')
      }
    },
    FunctionName: names.sendRequestLambdaName, 
    Handler: "index.handler",
    Publish: true, 
    Role: roleName, 
    Runtime: "nodejs10.x"
  }).promise();
}

async function uploadLambdasToS3(){
  let sendRequestObject = await S3.putObject({
    Body: fs.readFileSync(pathes.sendRequestLambda), 
    Bucket: names.bucketName, 
    Key: names.sendRequestS3Name,
  }).promise();
  console.log('sendRequest loaded')

  let getRequestsObject = await S3.putObject({
    Body: fs.readFileSync(pathes.getRequestsLambda), 
    Bucket: names.bucketName, 
    Key: names.getRequestsS3Name,
  }).promise();
  console.log('getRequests loaded')
}

async function createRoleForLambda(){
  let roleName = await getRoleName();
  if(!roleName){
    let lambdaRole = await cretateIAMRole();
    roleName = await getRoleName();
  }
  let checkPolicy = await iam.getRolePolicy({
    PolicyName: names.roleName+'Policy', 
    RoleName: names.roleName
  }).promise().catch(async err=>{
    if(err.code === 'NoSuchEntity'){
      let setPoLicy = createRolePolicy()
    }
    else throw err
  });
  console.log('policy set')
}
async function createLambdaFunctions(){
  let lambdaPost = await LAMBDA.getFunction({
    FunctionName: names.sendRequestLambda
  }).promise().catch(async err=>{
    if(err.code==='ResourceNotFoundException'){
      await createLambdaFunction(names.sendRequestS3Name)
      console.log('sendRequest lambda created')
    } else throw err
  })
  
  let lambdaGet = await LAMBDA.getFunction({
    FunctionName: names.getRequestsLambdaName
  }).promise().catch(async err=>{
    if(err.code==='ResourceNotFoundException'){
      await createLambdaFunction(names.getRequestsS3Name)
      console.log('getRequests lambda created')
    } else throw err
  })
}