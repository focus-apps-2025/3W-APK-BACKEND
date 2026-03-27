const bcrypt = require('bcryptjs'); // Or just 'bcrypt' depending on your package
const saltRounds = 10; // Or whatever salt rounds you use
const plaintextPassword = 'admin123';

bcrypt.hash(plaintextPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Hashed Password:', hash);
});