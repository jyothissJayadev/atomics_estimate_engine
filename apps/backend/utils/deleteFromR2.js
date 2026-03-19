const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getR2Client }         = require('../config/r2Client')

async function deleteFromR2(url) {
  if (!url) return false
  try {
    const r2  = getR2Client()
    let key
    if (url.startsWith('http')) {
      key = new URL(url).pathname.substring(1)
    } else {
      key = url
    }
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
    return true
  } catch (err) {
    console.error('R2 delete failed:', err.message)
    return false
  }
}

module.exports = { deleteFromR2 }
