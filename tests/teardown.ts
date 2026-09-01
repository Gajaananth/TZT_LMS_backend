export {};

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';

const prisma = require('../src/db/prisma/client').default;

module.exports = async () => {
  await prisma.$disconnect();
};