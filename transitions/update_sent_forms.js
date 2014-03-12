var _ = require('underscore'),
    moment = require('moment');

/*
 * TODO add description here
 */

module.exports = {
    filter: function(doc) {
        return Boolean(
            doc.form &&
            doc.reported_date &&
            doc.related_entities &&
            doc.related_entities.clinic &&
            doc.related_entities.clinic._id
        );
    },
    onMatch: function(change, db, audit, callback) {
        var doc = change.doc,
            form = doc.form,
            reported_date = doc.reported_date,
            clinic = doc.related_entities && doc.related_entities.clinic,
            clinicId = clinic && clinic._id;

        db.getDoc(clinicId, function(err, clinic) {
            var latest,
                reported = moment(reported_date);

            if (err) {
                callback(err);
            } else {
                _.defaults(clinic, {
                    sent_forms: {}
                });

                latest = clinic.sent_forms[form];

                if (!latest || moment(latest) < reported) {
                    clinic.sent_forms[form] = moment(reported_date).toISOString();
                }

                db.saveDoc(clinic, function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, true);
                    }
                });
            }
        });
    }
};
