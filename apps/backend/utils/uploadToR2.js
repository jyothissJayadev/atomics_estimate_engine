const { PutObjectCommand } = require('@aws-sdk/client-s3')
const { getR2Client }      = require('../config/r2Client')
const crypto = require('crypto')
const path   = require('path')

async function uploadToR2({ buffer, mimetype, originalName, folder }) {
  const r2     = getR2Client()
  const ext    = path.extname(originalName)
  const key    = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`

  await r2.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype
  }))

  return `${process.env.R2_PUBLIC_BASE_URL}/${key}`
}

module.exports = { uploadToR2 }
