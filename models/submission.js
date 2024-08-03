const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    code: String,
    language: String,
    output: String
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;