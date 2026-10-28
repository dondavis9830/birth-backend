import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const terminal = createInterface({ input: stdin, output: stdout });

async function promptForPassword(label) {
  const password = await terminal.question(`${label} password (minimum 12 characters): `);
  if (password.length < 12) {
    throw new Error('Use passwords with at least 12 characters.');
  }
  return password;
}

try {
  const birthdayPassword = await promptForPassword('Birthday page');
  const wishPassword = await promptForPassword('Video-wish page');
  if (birthdayPassword === wishPassword) {
    throw new Error('Choose a different password for each page.');
  }
  const birthdayHash = await bcrypt.hash(birthdayPassword, 12);
  const wishHash = await bcrypt.hash(wishPassword, 12);
  console.log('\nAdd these hashes to server/.env:\n');
  console.log(`BIRTHDAY_PAGE_PASSWORD_HASH=${birthdayHash}`);
  console.log(`WISH_PAGE_PASSWORD_HASH=${wishHash}`);
} finally {
  terminal.close();
}
