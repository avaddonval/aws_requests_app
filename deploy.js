let apiGateway = require('./src/apiGateway')
let s3 = require('./src/s3bucket')
let lambda = require('./src/lambda')
;(async () => {
  try {
    let s3Res = await s3.deploy();
    let lambdaRes = await lambda.deploy()
    let apiGatewayRes = await apiGateway.deploy();
  }catch(err){
    console.log(err)
  }
})();