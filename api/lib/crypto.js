const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

const encrypt = (text) => {
  if (typeof text !== 'string') throw new TypeError('암호화할 데이터는 문자열이어야 합니다.');
  const key = Buffer.from(process.env.ENCRYPTION_SECRET_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  const key = Buffer.from(process.env.ENCRYPTION_SECRET_KEY);
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt };
