const { S3Client } = require('@aws-sdk/client-s3')

let r2Instance = null

function getR2Client() {
  if (!r2Instance) {
    r2Instance = new S3Client({
      region:         'auto',
      endpoint:       process.env.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID?.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim()
      }
    })
  }
  return r2Instance
}

module.exports = { getR2Client }
