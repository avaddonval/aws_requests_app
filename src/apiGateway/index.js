let AWS = require('aws-sdk');
let config = require('config');
var fs = require('fs');
var path = require('path');
const REGION = config.get('project.region');
var credentials = new AWS.SharedIniFileCredentials({profile: config.get('project.profile')});
AWS.config.credentials = credentials;
AWS.config.update({region: REGION});
var apigateway = new AWS.APIGateway();
const LAMBDA = new AWS.Lambda();
const iam = new AWS.IAM();
const API_GATEWAY_NAME = config.get('project.name')+'_api_gateway'
const GET_REQUESTS_LAMBDA = 'get_requests'+config.get('project.name')
const SEND_REQUEST_LAMBDA = 'send_request'+config.get('project.name')
const ROLE_NAME = 'lambda-role-'+config.get('project.name');
async function deploy(){
  const ROLE_ARN = await getRoleName(); 
  let restApi
  let existsGateways = await apigateway.getRestApis({}).promise().then(data=>data)
  let existsGateway = existsGateways.items.find(item=>item.name===API_GATEWAY_NAME)
  if(existsGateway){
    restApi = existsGateway
  }else {
    restApi = await apigateway.createRestApi({
      name: API_GATEWAY_NAME,
      apiKeySource: "HEADER",
      description: config.get('project.description'),
      disableExecuteApiEndpoint: false,
      endpointConfiguration: {
        types: [
          "REGIONAL"
        ]
      },
      version: '0.0.1'
    }).promise().then((data)=>{
      return data
    }).catch(err=> {
      console.log(err);
      throw err
    })
  }
  
  
  let checkModels = await apigateway.getModels({
    restApiId: restApi.id
  }).promise().then(data=>data)
  let checkModel = checkModels.items.find(item => item.name==='RequestModel')
  if(!checkModel){
    let modelParams = {
      contentType: 'application/json', 
      name: 'RequestModel', 
      restApiId: restApi.id, 
      description: 'model for requests',
      schema: fs.readFileSync(path.join(__dirname,'./requestModel.json')).toString()
    };
    let requestModel = await apigateway.createModel(modelParams).promise();
  }
  let checkArrayModel = checkModels.items.find(item => item.name==='RequestModel')
  if(!checkArrayModel){
    let modelParams = {
      contentType: 'application/json', 
      name: 'RequestsArrayModel', 
      restApiId: restApi.id, 
      description: 'model for request arrays',
      schema: fs.readFileSync(path.join(__dirname,'./requestsArrayModel.json')).toString()
    };
    let requestModel = await apigateway.createModel(modelParams).promise();
  }
  let resources = await apigateway.getResources({
    restApiId: restApi.id
  }).promise();
  let checkSendRequestMethod = await apigateway.getMethod({
    httpMethod: 'POST', 
    resourceId: resources.items[0].id, 
    restApiId: restApi.id, 
  }).promise().then(data=>data).then(data=>data).catch(async err=>{
    if(err.code=='NotFoundException'){
      let sendRequestMethod = await apigateway.putMethod({
        authorizationType: 'NONE', 
        httpMethod: 'POST', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        apiKeyRequired: false,
        operationName: 'sendRequest',
        requestModels: {"application/json": "RequestModel"}
      }).promise();
      let getRequestsLambda = await LAMBDA.getFunction({
        FunctionName: SEND_REQUEST_LAMBDA
      }).promise()
      let integration = await apigateway.putIntegration({
        httpMethod: 'POST', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        type: 'AWS',
        integrationHttpMethod: 'POST',
        credentials: ROLE_ARN,
        requestTemplates: {
          'application/json': fs.readFileSync(path.join(__dirname,'./requestMapping.vtl')).toString()
        },
        uri: `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${getRequestsLambda.Configuration.FunctionArn}/invocations`
      }).promise(); 
      let integrationResponse = await apigateway.putIntegrationResponse({
        httpMethod: 'POST', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        statusCode: '200',
        contentHandling: "CONVERT_TO_TEXT",
      }).promise();
      let response = await apigateway.putMethodResponse({
        httpMethod: 'POST', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        statusCode: '200'
      }).promise();
      
    } else { throw err }
  });
  /*let checkGetRequestsMethod = await apigateway.getMethod({
    httpMethod: 'GET', 
    resourceId: resources.items[0].id, 
    restApiId: restApi.id, 
  }).promise().then(data=>data).catch( async err=>{
    if(err.code=='NotFoundException'){
      let getRequestMethod = await apigateway.putMethod({
        authorizationType: 'NONE', 
        httpMethod: 'GET', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        apiKeyRequired: false,
        operationName: 'getRequests'
      }).promise();
      let getRequestsLambda = await LAMBDA.getFunction({
        FunctionName: GET_REQUESTS_LAMBDA
      }).promise()
      
      let integration = await apigateway.putIntegration({
        httpMethod: 'GET', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        type: 'AWS',
        integrationHttpMethod: 'POST',
        credentials: ROLE_ARN,
        uri: `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${getRequestsLambda.Configuration.FunctionArn}/invocations`
      }).promise(); 
      let integrationResponse = await apigateway.putIntegrationResponse({
        httpMethod: 'GET', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        statusCode: '200'
      }).promise(); 
      let response = await apigateway.putMethodResponse({
        httpMethod: 'GET', 
        resourceId: resources.items[0].id, 
        restApiId: restApi.id, 
        statusCode: '200',
        responseModels: {
          "application/json": "RequestsArrayModel"
        },
      }).promise();
      console.log(response)
    } else { throw err }
  });*/
  let deployments = await apigateway.getDeployments({
    restApiId: restApi.id, 
  }).promise()
  if(!deployments.items || !deployments.items.length){
    let deployment = await apigateway.createDeployment({
      restApiId: restApi.id, 
      cacheClusterEnabled: false,
      description: 'prod',
      stageDescription: 'prod',
      stageName: 'prod',
      tracingEnabled: false
    }).promise().then(data=>{
      console.log(`API URL: https://${restApi.id}.execute-api.${REGION}.amazonaws.com/prod`)
    }).catch(err=>{console.log(err)});
  }

   
  
}
async function destroy(){
  let apiGateways = await apigateway.getRestApis({}).promise();
  for(gateway of apiGateways.items){
    if(gateway.name === API_GATEWAY_NAME){
      await apigateway.deleteRestApi({
        restApiId:gateway.id
      }).promise()
    }
  }
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