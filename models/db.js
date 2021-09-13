const mongoose = require('mongoose');
const UserSchema = require('./user');
const NoteSchema = require('./note');

mongoose.connect('mongodb+srv://vladudenis:alingras09@cluster0.d0plx.mongodb.net/Cluster0?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', (error) => console.log(error));
db.once('open', () => console.log('Connected to database.'));

module.exports = {
    User: mongoose.model('User', UserSchema),
    Note: mongoose.model('Note', NoteSchema)
};