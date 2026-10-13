const { randomBytes, createHash } = require('node:crypto')

function normalizeClaimCode(code) {
  return code.replace(/[-\s]/g, '').toUpperCase()
}

function hashClaimCode(code) {
  const normalized = normalizeClaimCode(code)

  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error('Invalid claim code format')
  }

  return createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex')
}

function generateClaimCode() {
  // 16 random bytes provide 128 bits of randomness.
  const rawCode = randomBytes(16).toString('hex').toUpperCase()

  // Groups make the code easier to read and copy.
  const claimCode = rawCode.match(/.{4}/g).join('-')

  return {
    claimCode,
    codeHash: hashClaimCode(claimCode),
    hashVersion: 'sha256-v1',
  }
}

module.exports = {
  generateClaimCode,
  hashClaimCode,
}