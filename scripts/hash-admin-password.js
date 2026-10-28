import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const password = await terminal.question('Enter a strong admin password: ');
  if (password.length < 12) {
    throw new Error('Use an admin password with at least 12 characters.');
  }
  console.log('\nAdd this hash to server/.env as ADMIN_PASSWORD_HASH:\n');
  console.log(await bcrypt.hash(password, 12));
} finally {
  terminal.close();
}
