import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/chronosai')
  .then(async () => {
    try {
      await mongoose.connection.collection('conversationsessions').dropIndex('sessionId_1');
      console.log('Index dropped successfully.');
    } catch (err) {
      console.log('Error dropping index or index does not exist', err);
    }
    process.exit(0);
  });
