const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = 'demo';
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Original password:', password);
  console.log('Hashed password:', hashedPassword);
  
  // Verify it works
  const isValid = await bcrypt.compare(password, hashedPassword);
  console.log('Verification test:', isValid ? 'PASS' : 'FAIL');
}

hashPassword().catch(console.error);